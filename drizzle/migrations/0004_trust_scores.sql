-- Trust Score (spec 7.2). Platform part is derived from real orders, reviews, invitations and disputes.
create or replace function public.compute_trust_score(_company uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  pd company_public_data%rowtype; has_pd boolean;
  age_years int := 0; p_age int := 0; p_tax int := 0; p_sodra int := 0; p_emp int := 0; p_vat int := 0; p_tender int := 0;
  completed int; on_time numeric; resp numeric; rating numeric; n_reviews int; lost int; invites int;
  p_ontime numeric := 0; p_resp numeric := 0; p_rating numeric := 0; p_disp int := 0;
  pub int; plat int; total int; neutral boolean; comps jsonb;
begin
  select * into pd from company_public_data where company_id = _company; has_pd := found;
  if has_pd then
    age_years := coalesce(extract(year from age(current_date, pd.registered_date))::int, 0);
    p_age := least(age_years, 15);
    p_tax := case when pd.tax_debt then 0 else 15 end;
    p_sodra := case when pd.sodra_debt then 0 else 10 end;
    p_emp := case when coalesce(pd.employees,0) = 0 then 0 when pd.employees < 5 then 4 when pd.employees < 20 then 7 else 10 end;
    p_vat := case when pd.vat_valid then 5 else 0 end;
    p_tender := case when pd.tender_wins = 0 then 0 when pd.tender_wins < 5 then 3 else 5 end;
  end if;
  pub := p_age + p_tax + p_sodra + p_emp + p_vat + p_tender;

  select count(*) into completed from orders where supplier_company_id = _company and status = 'completed';
  -- On time: delivered on or before agreed date (agreement date, else order date + lead time)
  select avg(case when d.delivered_at::date <= coalesce(a.delivery_date, (o.created_at + make_interval(days => coalesce(a.lead_time_days, 14)))::date) then 1 else 0 end)
    into on_time
    from orders o left join agreements a on a.id = o.agreement_id
    join lateral (select min(e.created_at) delivered_at from order_events e where e.order_id = o.id and e.status = 'delivered') d on d.delivered_at is not null
    where o.supplier_company_id = _company;
  -- Response: answered invitations (quote or decline) out of invitations older than 48 h or already answered
  select count(*), avg(case when status in ('quoted','declined','selected','not_selected') then 1 else 0 end)
    into invites, resp
    from rfq_recipients where supplier_company_id = _company
      and (status in ('quoted','declined','selected','not_selected','expired') or sent_at < now() - interval '48 hours');
  select avg(rating), count(*) into rating, n_reviews from reviews where supplier_company_id = _company;
  select count(*) into lost from disputes d join orders o on o.id = d.order_id
    where o.supplier_company_id = _company and d.status in ('resolved_partial_refund','resolved_full_refund');

  neutral := completed < 3;
  if neutral then plat := 20;
  else
    p_ontime := round(coalesce(on_time,0) * 15, 1);
    p_resp := round(coalesce(resp,0) * 10, 1);
    p_rating := round(coalesce(rating,0) / 5 * 10, 1);
    p_disp := greatest(5 - 2 * lost, 0);
    plat := round(p_ontime + p_resp + p_rating + p_disp);
  end if;

  total := case when has_pd and pd.status <> 'active' then 0 else least(pub + plat, 100) end;

  comps := jsonb_build_array(
    jsonb_build_object('key','age','points',p_age,'max',15,'source','public','value',age_years),
    jsonb_build_object('key','tax','points',p_tax,'max',15,'source','public','value',has_pd and not pd.tax_debt),
    jsonb_build_object('key','sodra','points',p_sodra,'max',10,'source','public','value',has_pd and not pd.sodra_debt),
    jsonb_build_object('key','employees','points',p_emp,'max',10,'source','public','value',pd.employees),
    jsonb_build_object('key','vat','points',p_vat,'max',5,'source','public','value',has_pd and pd.vat_valid),
    jsonb_build_object('key','tenders','points',p_tender,'max',5,'source','public','value',coalesce(pd.tender_wins,0)),
    jsonb_build_object('key','on_time','points',p_ontime,'max',15,'source','platform','value',round(on_time,2)),
    jsonb_build_object('key','response','points',p_resp,'max',10,'source','platform','value',round(resp,2)),
    jsonb_build_object('key','rating','points',p_rating,'max',10,'source','platform','value',round(rating,2)),
    jsonb_build_object('key','disputes','points',p_disp,'max',5,'source','platform','value',lost));

  insert into trust_scores (company_id, score, breakdown, public_data_date, computed_at)
  values (_company, total, jsonb_build_object('components', comps, 'public_points', pub, 'platform_points', plat,
      'platform_neutral', neutral, 'completed_orders', completed, 'review_count', n_reviews, 'invitations', invites,
      'status', coalesce(pd.status,'unknown')), pd.data_date, now())
  on conflict (company_id) do update set score = excluded.score, breakdown = excluded.breakdown,
    public_data_date = excluded.public_data_date, computed_at = now();

  -- Keep supplier profile stats in step with real platform data
  update supplier_profiles set on_time_rate = on_time, response_rate = resp, avg_rating = round(rating,2),
    review_count = n_reviews, disputes_lost = lost where company_id = _company;
  return total;
end $$;

-- Buyer reliability (spec 7.2): 70 base, +5 per completed order (max 100), -10 per pool no-show, -5 per late signature
create or replace function public.compute_buyer_reliability(_company uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare done int; noshow int; late int; rfqn int; s int;
begin
  select count(*) into done from orders where buyer_company_id = _company and status = 'completed';
  select count(*) into noshow from pool_members where buyer_company_id = _company and status = 'no_response';
  select count(*) into late from agreements a join rfqs r on r.id = a.rfq_id
    where r.buyer_company_id = _company and (coalesce(a.buyer_signed_at, now()) > a.created_at + interval '48 hours') and a.status <> 'cancelled';
  select count(*) into rfqn from rfqs where buyer_company_id = _company;
  s := greatest(0, least(100, 70 + 5 * done) - 10 * noshow - 5 * late);
  insert into buyer_reliability (company_id, score, rfqs_created, orders_completed, pool_no_shows, late_confirmations)
  values (_company, s, rfqn, done, noshow, late)
  on conflict (company_id) do update set score = excluded.score, rfqs_created = excluded.rfqs_created,
    orders_completed = excluded.orders_completed, pool_no_shows = excluded.pool_no_shows, late_confirmations = excluded.late_confirmations;
  return s;
end $$;

create or replace function public.recompute_all_scores() returns int
language plpgsql security definer set search_path = public
as $$
declare c record; n int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;
  for c in select id, type from companies loop
    if c.type = 'supplier' then perform compute_trust_score(c.id); else perform compute_buyer_reliability(c.id); end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Recompute on order completion, review, dispute resolution
create or replace function public.trg_recompute_from_order() returns trigger
language plpgsql security definer set search_path = public
as $$
declare oid uuid := coalesce(new.order_id, new.id); o orders%rowtype;
begin
  select * into o from orders where id = oid;
  if found then perform compute_trust_score(o.supplier_company_id); perform compute_buyer_reliability(o.buyer_company_id); end if;
  return new;
end $$;
create trigger orders_recompute_scores after update of status on public.orders
  for each row when (new.status = 'completed' and old.status is distinct from new.status)
  execute function public.trg_recompute_from_order();
create or replace function public.trg_recompute_from_child() returns trigger
language plpgsql security definer set search_path = public
as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = new.order_id;
  if found then perform compute_trust_score(o.supplier_company_id); perform compute_buyer_reliability(o.buyer_company_id); end if;
  return new;
end $$;
create trigger reviews_recompute_scores after insert on public.reviews
  for each row execute function public.trg_recompute_from_child();
create trigger disputes_recompute_scores after update of status on public.disputes
  for each row when (old.status is distinct from new.status) execute function public.trg_recompute_from_child();

revoke execute on function public.compute_trust_score(uuid), public.compute_buyer_reliability(uuid),
  public.trg_recompute_from_order(), public.trg_recompute_from_child() from public, anon, authenticated;
revoke execute on function public.recompute_all_scores() from public, anon;
grant execute on function public.recompute_all_scores() to authenticated;
grant execute on function public.compute_trust_score(uuid), public.compute_buyer_reliability(uuid), public.recompute_all_scores() to service_role;