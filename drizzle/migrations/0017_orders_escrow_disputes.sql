-- Orders lifecycle (spec 7.6): every change goes through these RPCs and writes an order event.
drop policy if exists "Buyer opens disputes" on public.disputes;

create or replace function public._order_event(_order uuid, _status order_status, _note text, _photos text[] default '{}')
returns void language sql security definer set search_path = public as $$
  update orders set status = _status, updated_at = now() where id = _order;
  insert into order_events(order_id, status, note, photo_urls, created_by) values (_order, _status, _note, coalesce(_photos,'{}'), auth.uid());
$$;
revoke all on function public._order_event(uuid, order_status, text, text[]) from public, anon, authenticated;

create or replace function public._notify_order(_order uuid, _to_buyer boolean, _title text, _body text)
returns void language sql security definer set search_path = public as $$
  insert into notifications(company_id, type, title, body, link)
  select case when _to_buyer then buyer_company_id else supplier_company_id end, 'order', order_number || ': ' || _title, _body,
    case when _to_buyer then '/app/orders/' else '/supplier/orders/' end || id
  from orders where id = _order;
$$;
revoke all on function public._notify_order(uuid, boolean, text, text) from public, anon, authenticated;

create or replace function public.buyer_pay_order(_order uuid, _method payment_method, _term_days int default 30)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = _order for update;
  if o.id is null or o.buyer_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  if o.status <> 'awaiting_payment' then raise exception 'This order is not awaiting payment'; end if;
  if _method = 'pay_later' then
    if o.total > 20000 then raise exception 'Pay later is available up to €20,000'; end if;
    if _term_days not in (30, 60) then raise exception 'Term must be 30 or 60 days'; end if;
    insert into financing_requests(order_id, buyer_company_id, amount, term_days, status, partner_fee_rate, decided_at)
    values (o.id, o.buyer_company_id, o.total, _term_days, 'approved', 0.015, now());
    insert into payments(order_id, milestone, amount, status, provider, held_at) values (o.id, 'full', o.total, 'held', 'demo_financing', now());
  elsif o.staged_payment then
    insert into payments(order_id, milestone, amount, status, held_at) values
      (o.id, 'drawing_approval', round(o.total * 0.3, 2), 'held', now()),
      (o.id, 'delivery', o.total - round(o.total * 0.3, 2), 'pending', null);
  else
    insert into payments(order_id, milestone, amount, status, held_at) values (o.id, 'full', o.total, 'held', now());
  end if;
  update orders set payment_method = _method where id = o.id;
  perform public._order_event(o.id, 'paid_escrow', case when _method = 'pay_later' then 'Paid with Pay later (' || _term_days || ' days)'
    when o.staged_payment then '30% held in escrow (drawing approval)' else 'Payment held in escrow' end);
  perform public._notify_order(o.id, false, 'Payment secured', 'Funds are held in escrow — you can start the order');
end $$;
grant execute on function public.buyer_pay_order(uuid, payment_method, int) to authenticated;

-- Staged orders: buyer pays the remaining 70% before delivery.
create or replace function public.buyer_pay_balance(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = _order;
  if o.id is null or o.buyer_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  update payments set status = 'held', held_at = now() where order_id = o.id and milestone = 'delivery' and status = 'pending';
  if not found then raise exception 'Nothing left to pay'; end if;
  insert into order_events(order_id, status, note, created_by) values (o.id, o.status, '70% balance held in escrow', auth.uid());
  perform public._notify_order(o.id, false, 'Balance secured', 'The remaining 70% is held in escrow');
end $$;
grant execute on function public.buyer_pay_balance(uuid) to authenticated;

create or replace function public.supplier_update_order(_order uuid, _status order_status, _note text, _photos text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare o orders; _flow order_status[] := array['paid_escrow','processing','shipped','in_transit','delivered']::order_status[];
begin
  select * into o from orders where id = _order;
  if o.id is null or o.supplier_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  if not (_status = any(_flow[2:5])) or array_position(_flow, o.status) is null or array_position(_flow, _status) <= array_position(_flow, o.status) then
    raise exception 'Status can only move forward after payment'; end if;
  if _status = 'delivered' and exists (select 1 from payments where order_id = o.id and status = 'pending') then
    raise exception 'The buyer must pay the remaining balance before delivery'; end if;
  perform public._order_event(o.id, _status, nullif(left(coalesce(_note,''), 1000), ''), _photos);
  perform public._notify_order(o.id, true, 'Status: ' || replace(_status::text, '_', ' '), coalesce(nullif(_note,''), 'The supplier updated your order'));
end $$;
grant execute on function public.supplier_update_order(uuid, order_status, text, text[]) to authenticated;

create or replace function public.supplier_add_milestone(_order uuid, _name text, _photos text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = _order;
  if o.id is null or o.supplier_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  if o.status not in ('paid_escrow','processing') then raise exception 'Milestones are added during production'; end if;
  insert into production_milestones(order_id, name, photo_urls) values (o.id, _name, coalesce(_photos,'{}'));
  perform public._notify_order(o.id, true, 'Production update', replace(_name, '_', ' ') || case when _name = 'drawing_approved' then ' — please approve the drawing' else '' end);
end $$;
grant execute on function public.supplier_add_milestone(uuid, text, text[]) to authenticated;

create or replace function public.buyer_approve_milestone(_milestone uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m production_milestones;
begin
  select * into m from production_milestones where id = _milestone;
  if m.id is null or not exists (select 1 from orders where id = m.order_id and buyer_company_id = public.my_company_id()) then raise exception 'Not your order'; end if;
  update production_milestones set approved_by_buyer = true where id = m.id;
  perform public._notify_order(m.order_id, false, 'Milestone approved', replace(m.name, '_', ' '));
end $$;
grant execute on function public.buyer_approve_milestone(uuid) to authenticated;

create or replace function public.buyer_accept_delivery(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = _order for update;
  if o.id is null or o.buyer_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  if o.status <> 'delivered' then raise exception 'You can accept once the order is delivered'; end if;
  update payments set status = 'released', released_at = now() where order_id = o.id and status = 'held';
  perform public._order_event(o.id, 'accepted', 'Buyer accepted delivery — escrow released');
  perform public._order_event(o.id, 'completed', 'Order completed');
  perform public._notify_order(o.id, false, 'Delivery accepted', 'Escrow released — payout on its way');
end $$;
grant execute on function public.buyer_accept_delivery(uuid) to authenticated;

create or replace function public.buyer_open_dispute(_order uuid, _reason text, _description text, _held numeric, _photos text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare o orders; _id uuid; _amt numeric;
begin
  select * into o from orders where id = _order for update;
  if o.id is null or o.buyer_company_id <> public.my_company_id() then raise exception 'Not your order'; end if;
  if o.status not in ('shipped','in_transit','delivered') then raise exception 'Disputes open after shipping and before acceptance'; end if;
  if length(trim(coalesce(_reason,''))) = 0 then raise exception 'Reason is required'; end if;
  _amt := coalesce(_held, round(o.total * 0.3, 2));
  if _amt <= 0 or _amt > o.total then raise exception 'Held amount must be between 0 and the order total'; end if;
  insert into disputes(order_id, opened_by, reason, description, photo_urls, held_amount)
  values (o.id, auth.uid(), left(trim(_reason), 200), left(_description, 2000), coalesce(_photos,'{}'), _amt) returning id into _id;
  perform public._order_event(o.id, 'disputed', 'Dispute opened: ' || left(trim(_reason), 200));
  perform public._notify_order(o.id, false, 'Dispute opened', _reason);
  insert into notifications(company_id, type, title, body, link) select null, 'dispute', 'New dispute on ' || o.order_number, _reason, '/admin/disputes';
  return _id;
end $$;
grant execute on function public.buyer_open_dispute(uuid, text, text, numeric, text[]) to authenticated;

create or replace function public.admin_resolve_dispute(_dispute uuid, _outcome dispute_status, _refund numeric, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare d disputes; o orders; _paid numeric; _r numeric;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into d from disputes where id = _dispute for update;
  if d.id is null or d.status <> 'open' then raise exception 'Dispute is not open'; end if;
  select * into o from orders where id = d.order_id;
  select coalesce(sum(amount),0) into _paid from payments where order_id = o.id and status = 'held';
  update disputes set status = _outcome, resolution_note = left(_note, 2000), resolved_at = now() where id = d.id;
  if _outcome = 'resolved_replacement' then
    perform public._order_event(o.id, 'shipped', 'Dispute resolved: replacement will be delivered');
  elsif _outcome = 'resolved_partial_refund' then
    _r := least(greatest(coalesce(_refund, d.held_amount), 0), _paid);
    -- refund proportionally on held payments, release the rest
    update payments set refunded_amount = round(amount * _r / nullif(_paid,0), 2), status = 'partially_released', released_at = now()
      where order_id = o.id and status = 'held';
    perform public._order_event(o.id, 'completed', 'Dispute resolved: partial refund €' || _r);
  elsif _outcome = 'resolved_full_refund' then
    update payments set refunded_amount = amount, status = 'refunded' where order_id = o.id and status = 'held';
    perform public._order_event(o.id, 'cancelled', 'Dispute resolved: full refund');
  elsif _outcome = 'rejected' then
    update payments set status = 'released', released_at = now() where order_id = o.id and status = 'held';
    perform public._order_event(o.id, 'completed', 'Dispute rejected — escrow released');
  else raise exception 'Invalid outcome'; end if;
  perform public._notify_order(o.id, true, 'Dispute resolved', coalesce(nullif(_note,''), replace(_outcome::text,'_',' ')));
  perform public._notify_order(o.id, false, 'Dispute resolved', coalesce(nullif(_note,''), replace(_outcome::text,'_',' ')));
end $$;
grant execute on function public.admin_resolve_dispute(uuid, dispute_status, numeric, text) to authenticated;

-- Order photos: private bucket, files under <order_id>/..., readable/writable by the order's parties.
create policy "Order parties read photos" on storage.objects for select to authenticated
  using (bucket_id = 'order-photos' and public.is_order_party(((storage.foldername(name))[1])::uuid));
create policy "Order parties upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-photos' and public.is_order_party(((storage.foldername(name))[1])::uuid));