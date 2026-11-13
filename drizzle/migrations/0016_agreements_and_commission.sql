-- Commission (spec 7.5) on line totals, per category commission group.
create or replace function public.calc_commission(_version uuid, _buyer uuid, _supplier uuid)
returns table(rate numeric, amount numeric) language plpgsql stable security definer set search_path = public as $$
declare _mat numeric := 0; _fur numeric := 0; _total numeric; _repeat boolean; _pro boolean; _mrate numeric; _amt numeric;
begin
  select coalesce(sum((l->>'line_total')::numeric) filter (where coalesce(c.commission_group,'materials') = 'materials'),0),
         coalesce(sum((l->>'line_total')::numeric) filter (where c.commission_group = 'furniture_equipment'),0)
    into _mat, _fur
  from quote_versions v cross join lateral jsonb_array_elements(v.lines) l
  left join rfq_items i on i.id = (l->>'rfq_item_id')::uuid left join categories c on c.id = i.category_id
  where v.id = _version;
  _total := _mat + _fur;
  if _total <= 0 then rate := 0; amount := 0; return next; return; end if;
  _repeat := exists (select 1 from orders where buyer_company_id = _buyer and supplier_company_id = _supplier and status = 'completed');
  _pro := coalesce((select pro_subscription from supplier_profiles where company_id = _supplier), false);
  if _repeat then
    _amt := _total * 0.01;
  else
    _mrate := case when _mat <= 5000 then 0.03 when _mat <= 50000 then 0.02 else 0.01 end;
    if _pro then _mrate := greatest(_mrate - 0.005, 0.01); end if;
    _amt := least(_mat * _mrate, 2000) + _fur * (case when _pro then 0.035 else 0.04 end);
  end if;
  amount := round(_amt, 2); rate := round(_amt / _total, 4); return next;
end $$;
revoke all on function public.calc_commission(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public._open_agreement(_quote uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare qu quotes; v quote_versions; _id uuid;
begin
  select * into qu from quotes where id = _quote;
  if qu.status not in ('sent','negotiating') then raise exception 'This quote is closed'; end if;
  if exists (select 1 from agreements where rfq_id = qu.rfq_id and status in ('pending','signed')) then
    raise exception 'An agreement is already open for this RFQ'; end if;
  select * into v from quote_versions where quote_id = qu.id and version = qu.current_version;
  if v.valid_until is not null and v.valid_until < current_date then raise exception 'This offer has expired'; end if;
  insert into agreements(rfq_id, quote_id, quote_version_id, total, lead_time_days, delivery_date, payment_terms)
  values (qu.rfq_id, qu.id, v.id, v.total, v.lead_time_days, v.delivery_date, v.payment_terms) returning id into _id;
  insert into audit_log(entity, entity_id, action, actor_profile_id, data) values ('agreement', _id, 'opened', auth.uid(), jsonb_build_object('version', v.version));
  return _id;
end $$;
revoke all on function public._open_agreement(uuid) from public, anon, authenticated;

create or replace function public.buyer_accept_quote(_quote uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare qu quotes; _id uuid;
begin
  select * into qu from quotes where id = _quote;
  if qu.id is null or not public.is_rfq_buyer(qu.rfq_id) then raise exception 'Not your RFQ'; end if;
  if (select party from quote_versions where quote_id = qu.id and version = qu.current_version) <> 'supplier' then
    raise exception 'Wait for the supplier to answer your counter-offer'; end if;
  _id := public._open_agreement(_quote);
  insert into notifications(company_id, type, title, body, link)
  values (qu.supplier_company_id, 'agreement', 'Your quote was accepted', 'Sign the agreement with Smart-ID', '/supplier/agreements/' || _id);
  return _id;
end $$;
grant execute on function public.buyer_accept_quote(uuid) to authenticated;

create or replace function public.supplier_accept_counter(_rfq uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare qu quotes; _id uuid;
begin
  select * into qu from quotes where rfq_id = _rfq and supplier_company_id = public.my_company_id();
  if qu.id is null then raise exception 'No quote'; end if;
  if (select party from quote_versions where quote_id = qu.id and version = qu.current_version) <> 'buyer' then
    raise exception 'No counter-offer to accept'; end if;
  _id := public._open_agreement(qu.id);
  insert into notifications(company_id, type, title, body, link)
  select buyer_company_id, 'agreement', 'Counter-offer accepted on ' || rfq_number, 'Sign the agreement with Smart-ID', '/app/agreements/' || _id from rfqs where id = _rfq;
  return _id;
end $$;
grant execute on function public.supplier_accept_counter(uuid) to authenticated;

create or replace function public.cancel_agreement(_agreement uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a agreements;
begin
  select * into a from agreements where id = _agreement;
  if a.id is null or not (public.is_rfq_buyer(a.rfq_id) or public.quote_supplier(a.quote_id) = public.my_company_id()) then raise exception 'Not your agreement'; end if;
  if a.status <> 'pending' then raise exception 'Only pending agreements can be cancelled'; end if;
  update agreements set status = 'cancelled' where id = a.id;
  insert into audit_log(entity, entity_id, action, actor_profile_id) values ('agreement', a.id, 'cancelled', auth.uid());
end $$;
grant execute on function public.cancel_agreement(uuid) to authenticated;

-- Sign with (demo) Smart-ID; second signature creates the order (spec 7.4).
create or replace function public.sign_agreement(_agreement uuid, _code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a agreements; qu quotes; f rfqs; _me uuid := public.my_company_id(); _order uuid; _num text; _c record; _staged boolean; r record;
begin
  if _code !~ '^[0-9]{4}$' then raise exception 'Invalid Smart-ID code'; end if;
  select * into a from agreements where id = _agreement for update;
  if a.id is null or a.status <> 'pending' then raise exception 'Agreement is not open for signing'; end if;
  select * into qu from quotes where id = a.quote_id;
  select * into f from rfqs where id = a.rfq_id;
  if _me = f.buyer_company_id then
    update agreements set buyer_signed_at = now(), buyer_signature_code = _code where id = a.id and buyer_signed_at is null;
  elsif _me = qu.supplier_company_id then
    update agreements set supplier_signed_at = now(), supplier_signature_code = _code where id = a.id and supplier_signed_at is null;
  else raise exception 'Not your agreement'; end if;
  insert into audit_log(entity, entity_id, action, actor_profile_id) values ('agreement', a.id, 'signed', auth.uid());
  select * into a from agreements where id = a.id;
  if a.buyer_signed_at is null or a.supplier_signed_at is null then
    insert into notifications(company_id, type, title, body, link)
    values (case when _me = f.buyer_company_id then qu.supplier_company_id else f.buyer_company_id end, 'agreement',
      'Agreement signed by the other side', f.rfq_number || ' — your signature is needed',
      case when _me = f.buyer_company_id then '/supplier/agreements/' else '/app/agreements/' end || a.id);
    return null;
  end if;

  update agreements set status = 'signed' where id = a.id;
  update quotes set status = 'accepted', updated_at = now() where id = qu.id;
  update rfq_recipients set status = 'selected' where id = qu.recipient_id;
  update rfqs set status = 'closed', closed_at = now(), updated_at = now() where id = f.id;
  for r in select q2.*, (select total from quote_versions where quote_id = q2.id and version = q2.current_version and party = 'supplier') t
           from quotes q2 where q2.rfq_id = f.id and q2.id <> qu.id loop
    update quotes set status = 'rejected', updated_at = now() where id = r.id and status in ('sent','negotiating');
    update rfq_recipients set status = 'not_selected' where id = r.recipient_id;
    insert into notifications(company_id, type, title, body, link)
    values (r.supplier_company_id, 'quote', 'Not selected on ' || f.rfq_number,
      case when r.t is not null and a.total > 0 and r.t > a.total
        then 'Your total was ' || round((r.t - a.total) / a.total * 100) || '% above the selected offer.'
        else 'The buyer chose another offer.' end, '/supplier/inbox/' || f.id);
  end loop;

  select * into _c from public.calc_commission(a.quote_version_id, f.buyer_company_id, qu.supplier_company_id);
  _staged := exists (select 1 from quote_versions v cross join lateral jsonb_array_elements(v.lines) l
    join rfq_items i on i.id = (l->>'rfq_item_id')::uuid join categories c on c.id = i.category_id
    where v.id = a.quote_version_id and c."group" = 'fitout' and c.commission_group = 'furniture_equipment');
  perform pg_advisory_xact_lock(hashtext('order_number'));
  select 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad((coalesce(max(substring(order_number from 10)::int), 0) + 1)::text, 4, '0')
    into _num from orders where order_number like 'ORD-' || to_char(now(), 'YYYY') || '-%';
  insert into orders(order_number, agreement_id, rfq_id, buyer_company_id, supplier_company_id, total, commission_rate,
    commission_amount, supplier_payout, status, staged_payment)
  values (_num, a.id, f.id, f.buyer_company_id, qu.supplier_company_id, a.total, _c.rate, _c.amount, a.total - _c.amount, 'awaiting_payment', _staged)
  returning id into _order;
  insert into order_events(order_id, status, note, created_by) values (_order, 'awaiting_payment', 'Agreement signed by both parties', auth.uid());
  insert into notifications(company_id, type, title, body, link) values
    (f.buyer_company_id, 'order', 'Order ' || _num || ' created', 'Agreement signed — continue to payment', '/app/orders'),
    (qu.supplier_company_id, 'order', 'Order ' || _num || ' created', 'Agreement signed — waiting for buyer payment', '/supplier/orders');
  insert into audit_log(entity, entity_id, action, actor_profile_id, data) values ('order', _order, 'created', auth.uid(), jsonb_build_object('commission', _c.amount));
  return _order;
end $$;
grant execute on function public.sign_agreement(uuid, text) to authenticated;

-- Commission is shown to suppliers only: buyers read orders through a view without commission columns.
revoke select on public.orders from authenticated;
grant select (id, order_number, agreement_id, rfq_id, buyer_company_id, supplier_company_id, pool_id, total, payment_method,
  status, staged_payment, created_at, updated_at) on public.orders to authenticated;
create or replace function public.my_order_commission(_order uuid)
returns table(commission_rate numeric, commission_amount numeric, supplier_payout numeric)
language sql stable security definer set search_path = public as $$
  select commission_rate, commission_amount, supplier_payout from orders
  where id = _order and supplier_company_id = public.my_company_id()
  union all
  select commission_rate, commission_amount, supplier_payout from orders where id = _order and public.is_admin();
$$;
grant execute on function public.my_order_commission(uuid) to authenticated;