create policy "material scans: company insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'material-scans' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "material scans: company read" on storage.objects for select to authenticated
  using (bucket_id = 'material-scans' and ((storage.foldername(name))[1] = public.my_company_id()::text or public.is_admin()));

create table public.material_scans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null default auth.uid(),
  photo_paths text[] not null default '{}',
  note text,
  status text not null check (status in ('identified','uncertain','not_a_material','failed')),
  result jsonb not null default '{}',
  source text not null default 'ai' check (source in ('ai','demo')),
  saved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.material_scans to authenticated;
grant all on public.material_scans to service_role;
alter table public.material_scans enable row level security;
create policy "own company scans read" on public.material_scans for select to authenticated
  using (company_id = public.my_company_id() or public.is_admin());
create policy "own scans insert" on public.material_scans for insert to authenticated
  with check (company_id = public.my_company_id() and profile_id = auth.uid());
create policy "own scans update" on public.material_scans for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and company_id = public.my_company_id());

alter table public.rfqs add column if not exists preferred_supplier_ids uuid[] not null default '{}';
alter table public.rfqs add column if not exists material_scan_id uuid references public.material_scans(id) on delete set null;
alter table public.rfqs drop constraint if exists rfqs_source_check;
alter table public.rfqs add constraint rfqs_source_check check (source in ('manual','snap_source','kit','material_lens'));

create or replace function public.match_rfq(_rfq uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _max int; _n int := 0; c record; _buyer uuid; _pref uuid[];
begin
  select max_suppliers, buyer_company_id, preferred_supplier_ids into _max, _buyer, _pref from rfqs where id = _rfq;
  for c in select k.* from rank_rfq_candidates(_rfq) k
           order by (k.supplier_company_id = any(coalesce(_pref,'{}'))) desc, k.match_score desc, k.supplier_company_id
           limit coalesce(_max,5) loop
    _n := _n + 1;
    perform _invite_supplier(_rfq, c.supplier_company_id, c.match_score, _n, c.is_claimed);
  end loop;
  update rfqs set status = 'matched' where id = _rfq and status = 'submitted' and _n > 0;
  insert into notifications(company_id, type, title, body, link)
  select _buyer, 'matched', rfq_number || ' sent to ' || _n || ' suppliers', title, '/app/rfqs/' || id from rfqs where id = _rfq;
  return _n;
end $$;
revoke all on function public.match_rfq(uuid) from public, anon, authenticated;

create or replace function public.lens_suppliers(_category_slug text, _city text)
returns table(company_id uuid, name text, city text, country text, trust_score int, lead_time_days int,
  in_region boolean, product_name text, product_price numeric, product_currency text, product_stock numeric,
  price_updated_at timestamptz, match_score numeric)
language sql stable security definer set search_path = public as $$
  with cat as (select id from categories where slug = _category_slug),
  cats as (select id from categories where id in (select id from cat) or parent_id in (select id from cat))
  select c.id, c.name, c.city, c.country, coalesce(ts.score,0)::int, sp.typical_lead_time_days,
    (_city is null or _city = any(sp.regions_served)),
    p.name, p.list_price, p.currency, p.stock_qty, p.price_updated_at,
    round(0.5*coalesce(ts.score,0)/100 + 0.2*coalesce(sp.response_rate,0.5)
      + case when p.id is not null and coalesce(p.stock_qty,0) > 0 then 0.05 else 0 end
      + case when _city is null or _city = any(sp.regions_served) then 0.3 else 0 end, 4)
  from companies c
  join company_public_data cp on cp.company_id = c.id and cp.status = 'active'
  join supplier_profiles sp on sp.company_id = c.id
  left join trust_scores ts on ts.company_id = c.id
  left join lateral (select pr.* from products pr where pr.supplier_company_id = c.id and pr.is_active
      and pr.category_id in (select id from cats) order by (coalesce(pr.stock_qty,0) > 0) desc, pr.list_price nulls last limit 1) p on true
  where c.type = 'supplier' and auth.uid() is not null
    and exists (select 1 from supplier_categories sc where sc.supplier_id = c.id and sc.category_id in (select id from cats))
  order by 13 desc, 2 limit 8;
$$;
revoke all on function public.lens_suppliers(text, text) from public, anon;
grant execute on function public.lens_suppliers(text, text) to authenticated;