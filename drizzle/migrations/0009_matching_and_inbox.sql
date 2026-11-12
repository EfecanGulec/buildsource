-- Ranked eligible suppliers for an RFQ (spec 7.1 steps 1-3).
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
  select id, round(0.5*score/100 + 0.3*covered/(select n from ncat) + 0.2*rr, 4), is_claimed
  from cand order by 2 desc, id;
$$;
revoke all on function public.rank_rfq_candidates(uuid) from public, anon, authenticated;

create or replace function public._invite_supplier(_rfq uuid, _supplier uuid, _score numeric, _rank int, _claimed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _num text; _title text;
begin
  insert into rfq_recipients(rfq_id, supplier_company_id, match_score, rank, status, sent_at, magic_token)
  values (_rfq, _supplier, _score, _rank, 'sent', now(),
          case when _claimed then null else encode(gen_random_bytes(18),'hex') end)
  on conflict do nothing;
  select rfq_number, title into _num, _title from rfqs where id = _rfq;
  insert into notifications(company_id, type, title, body, link)
  values (_supplier, 'new_rfq', 'New RFQ ' || _num, _title, '/supplier/inbox/' || _rfq);
end $$;
revoke all on function public._invite_supplier(uuid,uuid,numeric,int,boolean) from public, anon, authenticated;

-- Spec 7.1 steps 4-5: invite the top max_suppliers and mark the RFQ matched.
create or replace function public.match_rfq(_rfq uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _max int; _n int := 0; c record; _buyer uuid;
begin
  select max_suppliers, buyer_company_id into _max, _buyer from rfqs where id = _rfq;
  for c in select * from rank_rfq_candidates(_rfq) limit coalesce(_max,5) loop
    _n := _n + 1;
    perform _invite_supplier(_rfq, c.supplier_company_id, c.match_score, _n, c.is_claimed);
  end loop;
  update rfqs set status = 'matched' where id = _rfq and status = 'submitted' and _n > 0;
  insert into notifications(company_id, type, title, body, link)
  select _buyer, 'matched', rfq_number || ' sent to ' || _n || ' suppliers', title, '/app/rfqs/' || id from rfqs where id = _rfq;
  return _n;
end $$;
revoke all on function public.match_rfq(uuid) from public, anon, authenticated;

create or replace function public.rfqs_after_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted')
     and not exists (select 1 from rfq_recipients where rfq_id = new.id) then
    perform match_rfq(new.id);
  end if;
  return null;
end $$;
drop trigger if exists rfqs_match_on_submit on public.rfqs;
create trigger rfqs_match_on_submit after insert or update of status on public.rfqs
  for each row execute function public.rfqs_after_submit();

-- Reroute: invite the next-ranked supplier not yet contacted.
create or replace function public.reroute_rfq(_rfq uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c record; _rank int;
begin
  select coalesce(max(rank),0)+1 into _rank from rfq_recipients where rfq_id = _rfq;
  select * into c from rank_rfq_candidates(_rfq) k
   where not exists (select 1 from rfq_recipients x where x.rfq_id = _rfq and x.supplier_company_id = k.supplier_company_id)
   limit 1;
  if c.supplier_company_id is null then return null; end if;
  perform _invite_supplier(_rfq, c.supplier_company_id, c.match_score, _rank, c.is_claimed);
  return c.supplier_company_id;
end $$;
revoke all on function public.reroute_rfq(uuid) from public, anon, authenticated;

-- Suppliers act on invites only through these functions, so they cannot alter rank/score.
drop policy if exists "Supplier updates own invites" on public.rfq_recipients;

create or replace function public.supplier_view_rfq(_rfq uuid)
returns void language sql security definer set search_path = public as $$
  update rfq_recipients set viewed_at = coalesce(viewed_at, now()),
         status = case when status = 'sent' then 'viewed'::recipient_status else status end
  where rfq_id = _rfq and supplier_company_id = my_company_id();
$$;
grant execute on function public.supplier_view_rfq(uuid) to authenticated;

create or replace function public.supplier_decline_rfq(_rfq uuid, _reason decline_reason, _message text)
returns void language plpgsql security definer set search_path = public as $$
declare _rid uuid; _buyer uuid; _num text; _me text;
begin
  update rfq_recipients set status = 'declined', decline_reason = _reason, decline_message = nullif(trim(_message),''), responded_at = now()
   where rfq_id = _rfq and supplier_company_id = my_company_id() and status in ('sent','viewed')
   returning id into _rid;
  if _rid is null then raise exception 'Nothing to decline'; end if;
  select buyer_company_id, rfq_number into _buyer, _num from rfqs where id = _rfq;
  select name into _me from companies where id = my_company_id();
  insert into notifications(company_id, type, title, body, link)
  values (_buyer, 'declined', _me || ' declined ' || _num, _reason::text, '/app/rfqs/' || _rfq);
  perform reroute_rfq(_rfq);
end $$;
grant execute on function public.supplier_decline_rfq(uuid, decline_reason, text) to authenticated;

-- 24 h reminder and 48 h timeout → reroute. now_offset lets the demo simulate time passing.
create or replace function public.process_rfq_timeouts(_offset interval default '0'::interval)
returns json language plpgsql security definer set search_path = public as $$
declare r record; _rem int := 0; _rer int := 0;
begin
  update rfq_recipients set reminder_sent_at = now()
   where status in ('sent','viewed') and reminder_sent_at is null and sent_at + interval '24 hours' <= now() + _offset;
  get diagnostics _rem = row_count;
  for r in select id, rfq_id from rfq_recipients
            where status in ('sent','viewed') and sent_at + interval '48 hours' <= now() + _offset
              and not exists (select 1 from quotes q where q.recipient_id = rfq_recipients.id) loop
    update rfq_recipients set status = 'rerouted' where id = r.id;
    perform reroute_rfq(r.rfq_id);
    _rer := _rer + 1;
  end loop;
  return json_build_object('reminders', _rem, 'rerouted', _rer);
end $$;
revoke all on function public.process_rfq_timeouts(interval) from public, anon, authenticated;

create or replace function public.admin_simulate_48h()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return process_rfq_timeouts(interval '48 hours 1 minute');
end $$;
grant execute on function public.admin_simulate_48h() to authenticated;