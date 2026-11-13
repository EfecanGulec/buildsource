alter table public.group_buy_pools add column if not exists closed_at timestamptz, add column if not exists confirm_until timestamptz;
create unique index if not exists pool_members_one_per_buyer on public.pool_members(pool_id, buyer_company_id);

-- Memberships change only through RPCs; buyers read their own row, pool owner reads members.
drop policy if exists "Buyer manages own memberships" on public.pool_members;
create policy "Buyer reads own memberships" on public.pool_members for select to authenticated using (buyer_company_id = public.my_company_id());

-- Tier helper: discount for a quantity.
create or replace function public.pool_tier_discount(_tiers jsonb, _qty numeric) returns numeric language sql immutable as $$
  select coalesce(max((t->>'discount_pct')::numeric) filter (where (t->>'min_qty')::numeric <= _qty), 0)
  from jsonb_array_elements(coalesce(_tiers,'[]')) t $$;
grant execute on function public.pool_tier_discount(jsonb, numeric) to authenticated;

-- Anonymous totals only.
create or replace function public.pool_totals(_pool uuid) returns table(total_qty numeric, members int, confirmed_qty numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity) filter (where status in ('joined','confirmed')),0),
         count(*) filter (where status in ('joined','confirmed'))::int,
         coalesce(sum(quantity) filter (where status = 'confirmed'),0)
  from pool_members where pool_id = _pool $$;
grant execute on function public.pool_totals(uuid) to authenticated;

create or replace function public.pool_join(_pool uuid, _qty numeric, _if_fails text default 'order_alone') returns void
language plpgsql security definer set search_path = public as $$
declare p group_buy_pools; _me uuid := public.my_company_id();
begin
  select * into p from group_buy_pools where id = _pool;
  if p.id is null or p.status <> 'open' or (p.deadline is not null and p.deadline < now()) then raise exception 'This pool is not open'; end if;
  if not exists (select 1 from companies where id = _me and type = 'buyer') then raise exception 'Only buyers can join pools'; end if;
  if _qty is null or _qty <= 0 then raise exception 'Enter a quantity above 0'; end if;
  if _if_fails not in ('order_alone','cancel') then raise exception 'Invalid choice'; end if;
  insert into pool_members(pool_id, buyer_company_id, quantity, if_pool_fails, status, joined_at)
  values (_pool, _me, _qty, _if_fails, 'joined', now())
  on conflict (pool_id, buyer_company_id) do update set quantity = excluded.quantity, if_pool_fails = excluded.if_pool_fails, status = 'joined', joined_at = now();
end $$;
grant execute on function public.pool_join(uuid, numeric, text) to authenticated;

create or replace function public.pool_leave(_pool uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from group_buy_pools where id = _pool and status = 'open') then raise exception 'You can only leave an open pool'; end if;
  update pool_members set status = 'left' where pool_id = _pool and buyer_company_id = public.my_company_id() and status = 'joined';
  if not found then raise exception 'You are not in this pool'; end if;
end $$;
grant execute on function public.pool_leave(uuid) to authenticated;

create or replace function public._next_order_number() returns text language plpgsql security definer set search_path = public as $$
declare _num text;
begin
  perform pg_advisory_xact_lock(hashtext('order_number'));
  select 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad((coalesce(max(substring(order_number from 10)::int), 0) + 1)::text, 4, '0')
    into _num from orders where order_number like 'ORD-' || to_char(now(), 'YYYY') || '-%';
  return _num;
end $$;
revoke all on function public._next_order_number() from public, anon, authenticated;

-- Close a pool (deadline reached or admin/owner "Close now").
create or replace function public._close_pool(_pool uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p group_buy_pools; _qty numeric; _disc numeric; m record; _rfq uuid;
begin
  select * into p from group_buy_pools where id = _pool for update;
  if p.status <> 'open' then raise exception 'Pool is not open'; end if;
  select total_qty into _qty from pool_totals(_pool);
  if _qty < p.min_qty then
    update group_buy_pools set status = 'cancelled', closed_qty = _qty, closed_at = now() where id = _pool;
    for m in select * from pool_members where pool_id = _pool and status = 'joined' loop
      if m.if_pool_fails = 'order_alone' then
        insert into rfqs(rfq_number, buyer_company_id, project_type, title, description, delivery_city, status, submitted_at)
        values ('', m.buyer_company_id, 'business_fitout', p.product_name || ' (from Group Buy)',
          'Pool did not reach its minimum. Requested at the pool max price €' || p.base_price || ' / ' || p.unit, p.region, 'draft', now())
        returning id into _rfq;
        insert into rfq_items(rfq_id, category_id, description, specs, quantity, unit, buyer_confirmed)
        values (_rfq, p.category_id, p.product_name, coalesce(p.product_specs,'{}'), m.quantity, p.unit, true);
        perform _invite_supplier(_rfq, p.supplier_company_id, 1, 1, (select is_claimed from companies where id = p.supplier_company_id));
        update rfqs set status = 'matched' where id = _rfq;
        update pool_members set status = 'declined', rfq_id = _rfq where id = m.id;
        insert into notifications(company_id, type, title, body, link) values (m.buyer_company_id, 'pool', 'Pool did not reach its minimum',
          'We sent your own RFQ for ' || m.quantity || ' ' || p.unit || ' to the supplier', '/app/rfqs/' || _rfq);
      else
        update pool_members set status = 'declined' where id = m.id;
        insert into notifications(company_id, type, title, body, link) values (m.buyer_company_id, 'pool', 'Pool did not reach its minimum',
          p.product_name || ' — you have been released', '/app/group-buy/' || _pool);
      end if;
    end loop;
    return 'cancelled';
  end if;
  _disc := pool_tier_discount(p.tiers, _qty);
  update group_buy_pools set status = 'confirming', closed_qty = _qty, closed_at = now(),
    confirm_until = now() + make_interval(hours => p.confirm_window_hours),
    final_discount_pct = _disc, final_unit_price = round(p.base_price * (1 - _disc/100), 2) where id = _pool;
  insert into notifications(company_id, type, title, body, link)
  select buyer_company_id, 'pool', 'Confirm your Group Buy within ' || p.confirm_window_hours || ' h',
    p.product_name || ': ' || quantity || ' × €' || round(p.base_price * (1 - _disc/100), 2) || ' = €' || round(quantity * round(p.base_price * (1 - _disc/100), 2), 2),
    '/app/group-buy/' || _pool
  from pool_members where pool_id = _pool and status = 'joined';
  return 'confirming';
end $$;
revoke all on function public._close_pool(uuid) from public, anon, authenticated;

create or replace function public.close_pool_now(_pool uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.pool_owner(_pool) = public.my_company_id()) then raise exception 'Not allowed'; end if;
  return public._close_pool(_pool);
end $$;
grant execute on function public.close_pool_now(uuid) to authenticated;

-- Member confirms with demo Smart-ID: own order at the tier price.
create or replace function public.pool_confirm(_pool uuid, _code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p group_buy_pools; m pool_members; _total numeric; _rate numeric; _order uuid; _num text;
begin
  if _code !~ '^[0-9]{4}$' then raise exception 'Invalid Smart-ID code'; end if;
  select * into p from group_buy_pools where id = _pool;
  if p.status <> 'confirming' or p.confirm_until < now() then raise exception 'The confirmation window is closed'; end if;
  select * into m from pool_members where pool_id = _pool and buyer_company_id = public.my_company_id() and status = 'joined' for update;
  if m.id is null then raise exception 'Nothing to confirm'; end if;
  _total := round(m.quantity * p.final_unit_price, 2);
  select case when c.commission_group = 'furniture_equipment' then 0.04 else 0.03 end into _rate from categories c where c.id = p.category_id;
  _rate := coalesce(_rate, 0.03);
  _num := _next_order_number();
  insert into orders(order_number, pool_id, buyer_company_id, supplier_company_id, total, commission_rate, commission_amount, supplier_payout, status)
  values (_num, _pool, m.buyer_company_id, p.supplier_company_id, _total, _rate, round(_total*_rate,2), _total - round(_total*_rate,2), 'awaiting_payment')
  returning id into _order;
  insert into order_events(order_id, status, note, created_by) values (_order, 'awaiting_payment', 'Group Buy confirmed with Smart-ID', auth.uid());
  update pool_members set status = 'confirmed', confirmed_at = now(), order_id = _order where id = m.id;
  insert into notifications(company_id, type, title, body, link) values
    (p.supplier_company_id, 'order', 'Order ' || _num || ' from Group Buy', p.product_name, '/supplier/orders/' || _order);
  return _order;
end $$;
grant execute on function public.pool_confirm(uuid, text) to authenticated;

-- After the window: keep-tier rule, no-shows.
create or replace function public._finalize_pool(_pool uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p group_buy_pools; _conf numeric; _disc numeric; _price numeric; m record;
begin
  select * into p from group_buy_pools where id = _pool for update;
  if p.status <> 'confirming' then raise exception 'Pool is not confirming'; end if;
  for m in select * from pool_members where pool_id = _pool and status = 'joined' loop
    update pool_members set status = 'no_response' where id = m.id;
    perform compute_buyer_reliability(m.buyer_company_id);
  end loop;
  select confirmed_qty into _conf from pool_totals(_pool);
  if _conf < p.keep_tier_threshold * p.closed_qty then
    _disc := pool_tier_discount(p.tiers, _conf);
    _price := round(p.base_price * (1 - _disc/100), 2);
    if _price <> p.final_unit_price then
      update group_buy_pools set final_discount_pct = _disc, final_unit_price = _price where id = _pool;
      for m in select pm.*, o.commission_rate from pool_members pm join orders o on o.id = pm.order_id
               where pm.pool_id = _pool and pm.status = 'confirmed' and o.status = 'awaiting_payment' loop
        update orders set total = round(m.quantity*_price,2), commission_amount = round(round(m.quantity*_price,2)*m.commission_rate,2),
          supplier_payout = round(m.quantity*_price,2) - round(round(m.quantity*_price,2)*m.commission_rate,2), updated_at = now() where id = m.order_id;
        insert into notifications(company_id, type, title, body, link) values (m.buyer_company_id, 'pool', 'Group Buy tier recalculated',
          'Fewer buyers confirmed — new unit price €' || _price, '/app/orders/' || m.order_id);
      end loop;
    end if;
  end if;
  update group_buy_pools set status = 'ordered' where id = _pool;
end $$;
revoke all on function public._finalize_pool(uuid) from public, anon, authenticated;

create or replace function public.end_pool_window_now(_pool uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Not allowed'; end if;
  perform public._finalize_pool(_pool);
end $$;
grant execute on function public.end_pool_window_now(uuid) to authenticated;

-- Scheduled processor (deadlines + windows).
create or replace function public.process_pools() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from group_buy_pools where status = 'open' and deadline < now() loop perform _close_pool(r.id); n := n+1; end loop;
  for r in select id from group_buy_pools where status = 'confirming' and confirm_until < now() loop perform _finalize_pool(r.id); n := n+1; end loop;
  return n;
end $$;
revoke all on function public.process_pools() from public, anon, authenticated;
grant execute on function public.process_pools() to service_role;