create or replace function public.supplier_earnings()
returns table(order_id uuid, order_number text, buyer_name text, title text, status order_status, total numeric,
  commission_rate numeric, commission_amount numeric, supplier_payout numeric, paid_out boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.order_number, b.name, coalesce(r.title, p.product_name), o.status, o.total,
    o.commission_rate, o.commission_amount, o.supplier_payout,
    o.status in ('accepted','completed') or exists (select 1 from payments x where x.order_id = o.id and x.provider = 'demo_financing'),
    o.created_at
  from orders o join companies b on b.id = o.buyer_company_id
  left join rfqs r on r.id = o.rfq_id left join group_buy_pools p on p.id = o.pool_id
  where o.supplier_company_id = public.my_company_id() and o.status <> 'cancelled'
  order by o.created_at desc $$;
revoke all on function public.supplier_earnings() from public, anon;
grant execute on function public.supplier_earnings() to authenticated;