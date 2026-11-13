alter table public.rfqs
  add column if not exists unloading text check (unloading in ('manual','crane_needed','forklift_on_site')),
  add column if not exists site_access_notes text,
  add column if not exists delivery_window text check (delivery_window in ('morning','afternoon','any'));

create table public.rfq_site_contacts (
  rfq_id uuid primary key references public.rfqs(id) on delete cascade,
  name text, phone text
);
grant select, insert, update on public.rfq_site_contacts to authenticated;
grant all on public.rfq_site_contacts to service_role;
alter table public.rfq_site_contacts enable row level security;
create policy "buyer manages site contact" on public.rfq_site_contacts for all to authenticated
  using (public.is_rfq_buyer(rfq_id)) with check (public.is_rfq_buyer(rfq_id));
create policy "order supplier reads site contact" on public.rfq_site_contacts for select to authenticated
  using (exists (select 1 from public.orders o where o.rfq_id = rfq_site_contacts.rfq_id and o.supplier_company_id = public.my_company_id()));

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('supplier_own','carrier','pickup','pool_consolidated')),
  carrier text, tracking_number text,
  driver_token text unique,
  planned_date date, eta timestamptz,
  status text not null default 'planned' check (status in ('planned','ready_for_pickup','picked_up','in_transit','out_for_delivery','delivered','failed')),
  lines jsonb not null default '[]',
  last_location jsonb, late_alerted_at timestamptz,
  created_at timestamptz not null default now()
);
create index shipments_order on public.shipments(order_id);
create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null, description text, location text,
  source text not null check (source in ('driver','carrier_api','supplier','buyer')),
  occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index tracking_events_shipment on public.tracking_events(shipment_id);
create table public.proof_of_delivery (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null unique references public.shipments(id) on delete cascade,
  photo_urls text[] not null default '{}', receiver_name text not null, signature_url text,
  line_quantities jsonb not null default '[]', mismatch boolean not null default false, notes text,
  created_at timestamptz not null default now()
);
grant select on public.shipments, public.tracking_events, public.proof_of_delivery to authenticated;
grant all on public.shipments, public.tracking_events, public.proof_of_delivery to service_role;
alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;
alter table public.proof_of_delivery enable row level security;
create or replace function public.shipment_order(_shipment uuid) returns uuid language sql stable security definer set search_path = public
as $$ select order_id from public.shipments where id = _shipment $$;
create policy "parties read shipments" on public.shipments for select to authenticated using (public.is_order_party(order_id) or public.is_admin());
create policy "parties read tracking" on public.tracking_events for select to authenticated using (public.is_order_party(public.shipment_order(shipment_id)) or public.is_admin());
create policy "parties read pod" on public.proof_of_delivery for select to authenticated using (public.is_order_party(public.shipment_order(shipment_id)) or public.is_admin());

create or replace function public._order_lines(_order uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('key', i.id, 'name', i.description, 'unit', i.unit, 'quantity', (l->>'quantity')::numeric) order by i.sort_order)
       from orders o join agreements a on a.id = o.agreement_id join quote_versions v on v.id = a.quote_version_id
       cross join lateral jsonb_array_elements(v.lines) l join rfq_items i on i.id = (l->>'rfq_item_id')::uuid
      where o.id = _order),
    (select jsonb_build_array(jsonb_build_object('key', p.id, 'name', p.product_name, 'unit', p.unit, 'quantity', m.quantity))
       from orders o join group_buy_pools p on p.id = o.pool_id join pool_members m on m.order_id = o.id where o.id = _order limit 1),
    '[]'::jsonb)
$$;
revoke all on function public._order_lines(uuid) from public, anon, authenticated;

create or replace function public.order_lines(_order uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_order_party(_order) or public.is_admin()) then raise exception 'Not your order'; end if;
  return public._order_lines(_order);
end $$;
grant execute on function public.order_lines(uuid) to authenticated;

create or replace function public._shipment_event(_shipment uuid, _status text, _desc text, _location text, _source text)
returns void language plpgsql security definer set search_path = public as $$
declare s shipments; o orders; _rank text[] := array['planned','ready_for_pickup','picked_up','in_transit','out_for_delivery','delivered'];
  _flow order_status[] := array['paid_escrow','processing','shipped','in_transit','delivered']::order_status[]; _target order_status;
begin
  select * into s from shipments where id = _shipment for update;
  if s.id is null then raise exception 'Shipment not found'; end if;
  if s.status = 'delivered' then raise exception 'This delivery is already completed'; end if;
  if _status <> 'failed' and s.status <> 'failed' and array_position(_rank, _status) <= array_position(_rank, s.status) then
    raise exception 'Status can only move forward'; end if;
  update shipments set status = _status where id = s.id;
  insert into tracking_events(shipment_id, status, description, location, source) values (s.id, _status, nullif(left(coalesce(_desc,''),500),''), nullif(left(coalesce(_location,''),200),''), _source);
  select * into o from orders where id = s.order_id for update;
  _target := case _status when 'ready_for_pickup' then 'shipped' when 'picked_up' then 'shipped'
    when 'in_transit' then 'in_transit' when 'out_for_delivery' then 'in_transit' when 'delivered' then 'delivered' end;
  if _target = 'delivered' and (exists (select 1 from shipments where order_id = o.id and status <> 'delivered')
      or exists (select 1 from payments where order_id = o.id and status = 'pending')) then
    _target := 'in_transit';
  end if;
  if _target is not null and array_position(_flow, o.status) is not null and array_position(_flow, _target) > array_position(_flow, o.status) then
    perform public._order_event(o.id, _target, 'Delivery: ' || replace(_status, '_', ' ') || coalesce(' — ' || nullif(_desc,''), ''));
  end if;
  perform public._notify_order(o.id, true, 'Delivery ' || replace(_status, '_', ' '), coalesce(nullif(_desc,''), 'Tracking updated'));
  if _source <> 'supplier' then perform public._notify_order(o.id, false, 'Delivery ' || replace(_status, '_', ' '), coalesce(nullif(_desc,''), 'Tracking updated')); end if;
end $$;
revoke all on function public._shipment_event(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.supplier_create_shipment(_order uuid, _method text, _carrier text, _tracking text, _planned date, _lines jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o orders; _id uuid; _l jsonb;
begin
  select * into o from orders where id = _order;
  if o.id is null or o.supplier_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  if o.status not in ('paid_escrow','processing','shipped','in_transit') then raise exception 'Shipments can be planned after payment and before delivery'; end if;
  if _method not in ('supplier_own','carrier','pickup','pool_consolidated') then raise exception 'Unknown delivery method'; end if;
  if _method = 'carrier' and length(trim(coalesce(_tracking,''))) = 0 then raise exception 'Tracking number is required for carrier shipments'; end if;
  _l := coalesce(nullif(_lines, '[]'::jsonb), public._order_lines(o.id));
  insert into shipments(order_id, method, carrier, tracking_number, planned_date, lines, driver_token)
  values (o.id, _method, nullif(trim(coalesce(_carrier,'')),''), nullif(trim(coalesce(_tracking,'')),''), _planned, _l,
    case when _method in ('supplier_own','pool_consolidated') then replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') end)
  returning id into _id;
  insert into tracking_events(shipment_id, status, description, source) values (_id, 'planned',
    case _method when 'carrier' then coalesce(_carrier,'Carrier') || ' ' || _tracking when 'pickup' then 'Buyer collects' else 'Supplier delivery' end
    || coalesce(' · planned ' || to_char(_planned, 'YYYY-MM-DD'), ''), 'supplier');
  perform public._notify_order(o.id, true, 'Delivery planned', coalesce('Planned for ' || to_char(_planned, 'YYYY-MM-DD'), 'The supplier planned your delivery'));
  return _id;
end $$;
grant execute on function public.supplier_create_shipment(uuid, text, text, text, date, jsonb) to authenticated;

create or replace function public.supplier_update_shipment(_shipment uuid, _status text, _desc text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s shipments;
begin
  select * into s from shipments where id = _shipment;
  if s.id is null or not exists (select 1 from orders where id = s.order_id and supplier_company_id = public.my_company_id()) then raise exception 'Not your shipment'; end if;
  if _status = 'delivered' and s.method = 'pickup' then raise exception 'The buyer confirms collection'; end if;
  perform public._shipment_event(s.id, _status, _desc, null, 'supplier');
end $$;
grant execute on function public.supplier_update_shipment(uuid, text, text) to authenticated;

create or replace function public.buyer_confirm_pickup(_shipment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s shipments;
begin
  select * into s from shipments where id = _shipment;
  if s.id is null or not exists (select 1 from orders where id = s.order_id and buyer_company_id = public.my_company_id()) then raise exception 'Not your order'; end if;
  if s.method <> 'pickup' or s.status <> 'ready_for_pickup' then raise exception 'Collection can be confirmed once the order is ready for pickup'; end if;
  perform public._shipment_event(s.id, 'delivered', 'Collected by buyer', null, 'buyer');
end $$;
grant execute on function public.buyer_confirm_pickup(uuid) to authenticated;

create or replace function public._driver_shipment(_token text) returns shipments
language sql stable security definer set search_path = public as $$
  select * from shipments where driver_token = _token and length(coalesce(_token,'')) >= 32 limit 1
$$;
revoke all on function public._driver_shipment(text) from public, anon, authenticated;

create or replace function public.driver_token_ok(_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shipments where driver_token = _token and length(coalesce(_token,'')) >= 32 and status <> 'delivered')
$$;
grant execute on function public.driver_token_ok(text) to anon, authenticated;

create or replace function public.driver_get(_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shipments; o orders; r rfqs; c rfq_site_contacts;
begin
  s := public._driver_shipment(_token);
  if s.id is null then raise exception 'This delivery link is not valid'; end if;
  select * into o from orders where id = s.order_id;
  select * into r from rfqs where id = o.rfq_id;
  select * into c from rfq_site_contacts where rfq_id = o.rfq_id;
  return jsonb_build_object(
    'status', s.status, 'planned_date', s.planned_date, 'lines', s.lines, 'order_number', o.order_number,
    'buyer', (select name from companies where id = o.buyer_company_id),
    'supplier', (select name from companies where id = o.supplier_company_id),
    'city', coalesce(r.delivery_city, (select region from group_buy_pools where id = o.pool_id)),
    'address', r.delivery_address, 'window', r.delivery_window, 'unloading', r.unloading, 'access_notes', r.site_access_notes,
    'contact_name', c.name, 'contact_phone', c.phone,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'description', description, 'at', occurred_at) order by occurred_at), '[]') from tracking_events where shipment_id = s.id));
end $$;
grant execute on function public.driver_get(text) to anon, authenticated;

create or replace function public.driver_update(_token text, _status text, _lat numeric default null, _lng numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare s shipments;
begin
  s := public._driver_shipment(_token);
  if s.id is null then raise exception 'This delivery link is not valid'; end if;
  if _status not in ('picked_up','in_transit','out_for_delivery','failed') then raise exception 'Use the Delivered form to finish'; end if;
  if _lat is not null and _lng is not null then
    update shipments set last_location = jsonb_build_object('lat', _lat, 'lng', _lng, 'at', now()) where id = s.id;
  end if;
  perform public._shipment_event(s.id, _status, case _status when 'picked_up' then 'Driver picked up the goods' when 'failed' then 'Delivery attempt failed' else 'Driver is on the way' end,
    case when _lat is not null then round(_lat,4)::text || ', ' || round(_lng,4)::text end, 'driver');
end $$;
grant execute on function public.driver_update(text, text, numeric, numeric) to anon, authenticated;

create or replace function public.driver_deliver(_token text, _receiver text, _signature text, _photos text[], _received jsonb, _notes text)
returns boolean language plpgsql security definer set search_path = public as $$
declare s shipments; _mismatch boolean; l jsonb; _got numeric;
begin
  s := public._driver_shipment(_token);
  if s.id is null then raise exception 'This delivery link is not valid'; end if;
  if length(trim(coalesce(_receiver,''))) = 0 then raise exception 'Receiver name is required'; end if;
  if length(coalesce(_signature,'')) > 300000 then raise exception 'Signature is too large'; end if;
  if exists (select 1 from unnest(coalesce(_photos,'{}')) p where p not like s.driver_token || '/%') then raise exception 'Invalid photo'; end if;
  _mismatch := false;
  for l in select * from jsonb_array_elements(s.lines) loop
    select (x->>'received')::numeric into _got from jsonb_array_elements(coalesce(_received,'[]')) x where x->>'key' = l->>'key' limit 1;
    if _got is null or _got < 0 then raise exception 'Enter the received quantity for every line'; end if;
    if _got <> (l->>'quantity')::numeric then _mismatch := true; end if;
  end loop;
  insert into proof_of_delivery(shipment_id, photo_urls, receiver_name, signature_url, line_quantities, mismatch, notes)
  values (s.id, coalesce(_photos,'{}'), left(trim(_receiver),120), _signature, coalesce(_received,'[]'), _mismatch, nullif(left(coalesce(_notes,''),1000),''));
  perform public._shipment_event(s.id, 'delivered', 'Received by ' || left(trim(_receiver),120) || case when _mismatch then ' — quantities differ' else '' end, null, 'driver');
  return _mismatch;
end $$;
grant execute on function public.driver_deliver(text, text, text, text[], jsonb, text) to anon, authenticated;

create or replace function public.delivery_photo_party(_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shipments s where s.driver_token = _folder and (public.is_order_party(s.order_id) or public.is_admin()))
$$;
grant execute on function public.delivery_photo_party(text) to authenticated;
create policy "driver uploads delivery photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'delivery-photos' and public.driver_token_ok((storage.foldername(name))[1]));
create policy "parties read delivery photos" on storage.objects for select to authenticated
  using (bucket_id = 'delivery-photos' and public.delivery_photo_party((storage.foldername(name))[1]));

create or replace function public.shipment_late_alerts() returns int
language plpgsql security definer set search_path = public as $$
declare s record; n int := 0;
begin
  for s in select * from shipments where status <> 'delivered' and planned_date < current_date and late_alerted_at is null for update skip locked loop
    update shipments set late_alerted_at = now() where id = s.id;
    perform public._notify_order(s.order_id, true, 'Delivery is late', 'Planned for ' || to_char(s.planned_date, 'YYYY-MM-DD') || ' and not delivered yet');
    perform public._notify_order(s.order_id, false, 'Delivery is late', 'Planned for ' || to_char(s.planned_date, 'YYYY-MM-DD') || ' — update the tracking');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.shipment_late_alerts() from public, anon, authenticated;

create or replace function public._exec_job(_job text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  case _job
    when 'pool_close' then return jsonb_build_object('pools', process_pools());
    when 'rfq_timeouts' then return to_jsonb(process_rfq_timeouts());
    when 'quote_expiry' then return jsonb_build_object('expired', expire_stale_quotes());
    when 'trust_recompute' then return jsonb_build_object('companies', recompute_all_scores());
    when 'tracking_poll' then return jsonb_build_object('late_alerts', shipment_late_alerts());
    else raise exception 'Job % has no runner yet', _job;
  end case;
end $$;
revoke execute on function public._exec_job(text) from public, anon, authenticated;

select cron.schedule('bs-late-deliveries-daily', '0 6 * * *', $c$select public.scheduler_tick(array['tracking_poll'])$c$);