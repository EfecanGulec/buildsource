-- Buyer dashboard (spec §6): one place for the counts and the savings formula.
-- Savings = for each signed agreement, average of the other suppliers' latest totals minus the agreed total (if positive),
-- plus Group Buy savings (max price − final price) × confirmed quantity.
create or replace function public.buyer_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _me uuid := public.my_company_id(); _neg numeric; _pool numeric;
begin
  if _me is null then raise exception 'No company'; end if;
  select coalesce(sum(greatest(0, o.avg_other - a.total)),0) into _neg
  from agreements a join rfqs r on r.id = a.rfq_id
  cross join lateral (select avg(v.total) avg_other from quotes q2
    join quote_versions v on v.quote_id = q2.id and v.version = (select max(version) from quote_versions x where x.quote_id = q2.id and x.party = 'supplier')
    where q2.rfq_id = r.id and q2.id <> a.quote_id) o
  where r.buyer_company_id = _me and a.status = 'signed' and o.avg_other is not null;
  select coalesce(sum((p.base_price - p.final_unit_price) * m.quantity),0) into _pool
  from pool_members m join group_buy_pools p on p.id = m.pool_id
  where m.buyer_company_id = _me and m.status = 'confirmed' and p.final_unit_price is not null;
  return jsonb_build_object(
    'open_rfqs', (select count(*) from rfqs where buyer_company_id = _me and status in ('submitted','matched','quotes_received','negotiating')),
    'quotes_waiting', (select count(*) from quotes q join rfqs r on r.id = q.rfq_id
        join quote_versions v on v.quote_id = q.id and v.version = q.current_version
        where r.buyer_company_id = _me and q.status in ('sent','negotiating') and v.party = 'supplier'),
    'active_orders', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'status', status, 'total', total) order by created_at desc), '[]')
        from orders where buyer_company_id = _me and status not in ('completed','cancelled')),
    'pools', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'product_name', p.product_name, 'status', p.status, 'member_status', m.status, 'quantity', m.quantity, 'unit', p.unit)), '[]')
        from pool_members m join group_buy_pools p on p.id = m.pool_id
        where m.buyer_company_id = _me and m.status in ('joined','confirmed') and p.status in ('open','confirming')),
    'savings', round(_neg + _pool, 2),
    'savings_negotiation', round(_neg, 2),
    'savings_pools', round(_pool, 2));
end $$;
revoke all on function public.buyer_dashboard() from public, anon;
grant execute on function public.buyer_dashboard() to authenticated;

create or replace function public.supplier_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _me uuid := public.my_company_id();
begin
  if _me is null then raise exception 'No company'; end if;
  return jsonb_build_object(
    'new_rfqs', (select count(*) from rfq_recipients where supplier_company_id = _me and status in ('sent','viewed')),
    'threads_waiting', (select count(*) from quotes q join quote_versions v on v.quote_id = q.id and v.version = q.current_version
        where q.supplier_company_id = _me and q.status = 'negotiating' and v.party = 'buyer'),
    'orders_to_fulfil', (select count(*) from orders where supplier_company_id = _me and status in ('awaiting_payment','paid_escrow','processing','shipped','in_transit')),
    'won_this_month', (select coalesce(sum(total),0) from orders where supplier_company_id = _me and status <> 'cancelled' and created_at >= date_trunc('month', now())),
    'response_rate', (select response_rate from supplier_profiles where company_id = _me));
end $$;
revoke all on function public.supplier_dashboard() from public, anon;
grant execute on function public.supplier_dashboard() to authenticated;