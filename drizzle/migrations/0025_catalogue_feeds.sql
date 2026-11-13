create table public.product_feeds (
  id uuid primary key default gen_random_uuid(),
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('spreadsheet','xml','csv','woocommerce','shopify','prestashop','erp')),
  url text, credentials_secret_ref text,
  field_mapping jsonb not null default '{}',
  schedule text not null default 'daily' check (schedule in ('hourly','daily')),
  last_run_at timestamptz, last_status text, products_count int not null default 0,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  feed_id uuid references public.product_feeds(id) on delete cascade,
  external_id text not null, name text not null, description text,
  category_id uuid references public.categories(id), specs jsonb not null default '{}',
  unit text, list_price numeric, currency text not null default 'EUR', stock_qty numeric,
  lead_time_days int, images text[] not null default '{}', datasheet_url text,
  mapping_confidence numeric, mapping_confirmed boolean not null default false,
  price_updated_at timestamptz, is_active boolean not null default true,
  unique (feed_id, external_id)
);
create table public.feed_runs (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.product_feeds(id) on delete cascade,
  started_at timestamptz not null default now(), finished_at timestamptz,
  added int not null default 0, updated int not null default 0, deactivated int not null default 0,
  errors jsonb not null default '[]'
);
grant select on public.product_feeds, public.products, public.feed_runs to authenticated;
grant all on public.product_feeds, public.products, public.feed_runs to service_role;
alter table public.product_feeds enable row level security;
alter table public.products enable row level security;
alter table public.feed_runs enable row level security;
create policy "Supplier reads own feeds" on public.product_feeds for select to authenticated
  using (supplier_company_id = public.my_company_id() or public.is_admin());
create policy "Supplier reads own products" on public.products for select to authenticated
  using (supplier_company_id = public.my_company_id() or public.is_admin());
create policy "Supplier reads own runs" on public.feed_runs for select to authenticated
  using (exists (select 1 from product_feeds f where f.id = feed_id and (f.supplier_company_id = public.my_company_id() or public.is_admin())));

create or replace function public._my_supplier() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare _c uuid := my_company_id();
begin
  if _c is null or not exists (select 1 from companies where id = _c and type = 'supplier') then raise exception 'Suppliers only'; end if;
  return _c;
end $$;
revoke all on function public._my_supplier() from public, anon, authenticated;

create or replace function public.supplier_save_feed(_id uuid, _type text, _url text, _secret_ref text, _mapping jsonb, _schedule text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _c uuid := _my_supplier(); _fid uuid;
begin
  if _secret_ref is not null and _secret_ref !~ '^[A-Z][A-Z0-9_]{2,63}$' then raise exception 'Secret name must be like SHOP_API_KEY'; end if;
  if _url is not null and _url <> '' and _url !~ '^https://' and _url !~ '^/samples/' then raise exception 'Feed URL must start with https://'; end if;
  if _id is null then
    insert into product_feeds(supplier_company_id, type, url, credentials_secret_ref, field_mapping, schedule)
    values (_c, _type, nullif(_url,''), _secret_ref, coalesce(_mapping,'{}'), coalesce(_schedule,'daily')) returning id into _fid;
  else
    update product_feeds set type=_type, url=nullif(_url,''), credentials_secret_ref=_secret_ref, field_mapping=coalesce(_mapping,'{}'), schedule=coalesce(_schedule,'daily')
     where id = _id and supplier_company_id = _c returning id into _fid;
    if _fid is null then raise exception 'Feed not found'; end if;
  end if;
  return _fid;
end $$;
grant execute on function public.supplier_save_feed(uuid,text,text,text,jsonb,text) to authenticated;

-- _rows: [{external_id,name,description,category_id,unit,list_price,currency,stock_qty,lead_time_days,images,datasheet_url,mapping_confidence,specs}]
create or replace function public.supplier_import_products(_feed uuid, _rows jsonb, _errors jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = public as $$
declare _c uuid := _my_supplier(); _run uuid; _add int := 0; _upd int := 0; _deact int := 0; r jsonb; _ex products%rowtype;
begin
  if not exists (select 1 from product_feeds where id = _feed and supplier_company_id = _c) then raise exception 'Feed not found'; end if;
  if jsonb_array_length(coalesce(_rows,'[]')) > 5000 then raise exception 'Too many products (max 5000)'; end if;
  insert into feed_runs(feed_id) values (_feed) returning id into _run;
  for r in select * from jsonb_array_elements(coalesce(_rows,'[]')) loop
    select * into _ex from products where feed_id = _feed and external_id = r->>'external_id';
    if not found then
      insert into products(supplier_company_id, feed_id, external_id, name, description, category_id, specs, unit, list_price, currency,
        stock_qty, lead_time_days, images, datasheet_url, mapping_confidence, mapping_confirmed, price_updated_at)
      values (_c, _feed, r->>'external_id', left(r->>'name',300), r->>'description', nullif(r->>'category_id','')::uuid, coalesce(r->'specs','{}'),
        r->>'unit', nullif(r->>'list_price','')::numeric, coalesce(nullif(r->>'currency',''),'EUR'), nullif(r->>'stock_qty','')::numeric,
        nullif(r->>'lead_time_days','')::int, coalesce(array(select jsonb_array_elements_text(r->'images')),'{}'), r->>'datasheet_url',
        nullif(r->>'mapping_confidence','')::numeric, false, now());
      _add := _add + 1;
    else
      update products set name = left(r->>'name',300), description = r->>'description',
        -- a supplier-confirmed category is never overwritten by a re-import
        category_id = case when mapping_confirmed then category_id else nullif(r->>'category_id','')::uuid end,
        mapping_confidence = case when mapping_confirmed then mapping_confidence else nullif(r->>'mapping_confidence','')::numeric end,
        specs = coalesce(r->'specs','{}'), unit = r->>'unit', currency = coalesce(nullif(r->>'currency',''),'EUR'),
        price_updated_at = case when list_price is distinct from nullif(r->>'list_price','')::numeric then now() else price_updated_at end,
        list_price = nullif(r->>'list_price','')::numeric, stock_qty = nullif(r->>'stock_qty','')::numeric,
        lead_time_days = nullif(r->>'lead_time_days','')::int, images = coalesce(array(select jsonb_array_elements_text(r->'images')),'{}'),
        datasheet_url = r->>'datasheet_url', is_active = true
      where id = _ex.id;
      _upd := _upd + 1;
    end if;
  end loop;
  update products set is_active = false where feed_id = _feed and is_active
    and external_id not in (select e->>'external_id' from jsonb_array_elements(coalesce(_rows,'[]')) e);
  get diagnostics _deact = row_count;
  update feed_runs set finished_at = now(), added = _add, updated = _upd, deactivated = _deact, errors = coalesce(_errors,'[]') where id = _run;
  update product_feeds set last_run_at = now(), last_status = case when jsonb_array_length(coalesce(_errors,'[]')) > 0 then 'partial' else 'ok' end,
    products_count = (select count(*) from products where feed_id = _feed and is_active) where id = _feed;
  return jsonb_build_object('added',_add,'updated',_upd,'deactivated',_deact);
end $$;
grant execute on function public.supplier_import_products(uuid,jsonb,jsonb) to authenticated;

create or replace function public.supplier_confirm_product(_id uuid, _category uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update products set category_id = _category, mapping_confirmed = true, mapping_confidence = 1
   where id = _id and supplier_company_id = _my_supplier();
  if not found then raise exception 'Product not found'; end if;
end $$;
grant execute on function public.supplier_confirm_product(uuid,uuid) to authenticated;

-- Spec 18.1: level 0 dashboard only, 1 spreadsheet, 2 feed, 3 shop, 4 ERP.
create or replace function public.supplier_integration_level(_company uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(case type when 'erp' then 4 when 'woocommerce' then 3 when 'shopify' then 3 when 'prestashop' then 3
    when 'xml' then 2 when 'csv' then 2 else 1 end), 0)
  from product_feeds where supplier_company_id = _company and last_status in ('ok','partial');
$$;
grant execute on function public.supplier_integration_level(uuid) to authenticated, anon;

-- Spec 18.3 step 3: in-stock catalogue products in the RFQ's categories add a ranking bonus.
create or replace function public.rank_rfq_candidates(_rfq uuid)
returns table(supplier_company_id uuid, match_score numeric, is_claimed boolean)
language sql stable security definer set search_path = public as $$
  with r as (select * from rfqs where id = _rfq),
  cats as (select distinct category_id from rfq_items where rfq_id = _rfq and category_id is not null),
  ncat as (select greatest(count(*),1)::numeric n from cats),
  cand as (
    select c.id, c.is_claimed, count(distinct sc.category_id)::numeric covered,
           coalesce(ts.score,0) score, coalesce(sp.response_rate, 0.5) rr
    from companies c
    join company_public_data cp on cp.company_id = c.id and cp.status = 'active'
    join supplier_categories sc on sc.supplier_id = c.id and sc.category_id in (select category_id from cats)
    join supplier_profiles sp on sp.company_id = c.id
    left join trust_scores ts on ts.company_id = c.id
    cross join r
    where c.type = 'supplier'
      and r.delivery_city = any(sp.regions_served)
      and coalesce(ts.score,0) >= r.min_trust_score
    group by c.id, c.is_claimed, ts.score, sp.response_rate
  )
  select id, round(0.5*score/100 + 0.3*covered/(select n from ncat) + 0.2*rr
    + case when exists (select 1 from products p where p.supplier_company_id = cand.id and p.is_active
        and coalesce(p.stock_qty,0) > 0 and p.category_id in (select category_id from cats)) then 0.05 else 0 end, 4), is_claimed
  from cand order by 2 desc, id;
$$;
revoke all on function public.rank_rfq_candidates(uuid) from public, anon, authenticated;

-- Spec 18.3 step 5: when an order is created for a shop-connected supplier, queue the push-back (demo connector logs it).
create or replace function public.orders_catalog_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select * into f from product_feeds where supplier_company_id = new.supplier_company_id
    and type in ('woocommerce','shopify','prestashop','erp') and last_status in ('ok','partial') limit 1;
  if found then
    insert into integration_logs(service, action, request, response)
    values ('catalog', 'push_order:' || f.type, jsonb_build_object('order_id', new.id, 'order_number', new.order_number),
            jsonb_build_object('mode','demo','external_order_id', upper(f.type) || '-' || substr(new.id::text,1,8)));
  end if;
  return new;
end $$;
create trigger orders_catalog_push after insert on public.orders for each row execute function public.orders_catalog_push();