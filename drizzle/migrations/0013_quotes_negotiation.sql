-- Quotes and negotiation (spec 7.3): all writes go through these RPCs so the state machine is enforced.
drop policy if exists "Buyer updates quotes" on public.quotes;
drop policy if exists "Supplier creates own quotes" on public.quotes;
drop policy if exists "Supplier updates own quotes" on public.quotes;
drop policy if exists "Buyer counter-offers" on public.quote_versions;
drop policy if exists "Supplier offers" on public.quote_versions;

create or replace function public._add_quote_version(_quote uuid, _party offer_party, _offer jsonb, _profile uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _rfq uuid; _v int; _lines jsonb := '[]'::jsonb; l jsonb; it rfq_items; _price numeric; _sub numeric := 0; _del numeric;
begin
  select rfq_id, current_version + 1 into _rfq, _v from quotes where id = _quote;
  if jsonb_typeof(_offer->'lines') <> 'array' or jsonb_array_length(_offer->'lines') = 0 then raise exception 'Offer needs at least one priced line'; end if;
  for l in select * from jsonb_array_elements(_offer->'lines') loop
    select * into it from rfq_items where id = (l->>'rfq_item_id')::uuid and rfq_id = _rfq;
    if it.id is null then raise exception 'Line does not belong to this RFQ'; end if;
    _price := (l->>'unit_price')::numeric;
    if _price is null or _price < 0 then raise exception 'Unit prices must be 0 or more'; end if;
    _lines := _lines || jsonb_build_object('rfq_item_id', it.id, 'unit_price', _price, 'quantity', it.quantity,
      'line_total', round(_price * it.quantity, 2), 'note', left(coalesce(l->>'note',''), 300));
    _sub := _sub + round(_price * it.quantity, 2);
  end loop;
  _del := greatest(coalesce((_offer->>'delivery_cost')::numeric, 0), 0);
  insert into quote_versions(quote_id, version, party, lines, subtotal, delivery_cost, total, lead_time_days, delivery_date,
    warehouse_origin, valid_until, payment_terms, message, created_by)
  values (_quote, _v, _party, _lines, _sub, _del, _sub + _del, nullif(_offer->>'lead_time_days','')::int,
    nullif(_offer->>'delivery_date','')::date, nullif(_offer->>'warehouse_origin',''), nullif(_offer->>'valid_until','')::date,
    nullif(_offer->>'payment_terms',''), nullif(left(coalesce(_offer->>'message',''), 2000),''), _profile);
  update quotes set current_version = _v, updated_at = now() where id = _quote;
  return _v;
end $$;
revoke all on function public._add_quote_version(uuid, offer_party, jsonb, uuid) from public, anon, authenticated;

-- Supplier side (shared by signed-in suppliers and magic links): first quote or a revision after a counter.
create or replace function public._supplier_offer(_rec uuid, _offer jsonb, _profile uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare rr rfq_recipients; qu quotes; _v int; _buyer uuid; _num text; _rstatus rfq_status;
begin
  select * into rr from rfq_recipients where id = _rec;
  select buyer_company_id, rfq_number, status into _buyer, _num, _rstatus from rfqs where id = rr.rfq_id;
  if _rstatus not in ('matched','quotes_received','negotiating') then raise exception 'This RFQ is no longer open'; end if;
  select * into qu from quotes where recipient_id = rr.id;
  if qu.id is null then
    if rr.status not in ('sent','viewed') then raise exception 'You can no longer quote on this RFQ'; end if;
    insert into quotes(rfq_id, recipient_id, supplier_company_id, status) values (rr.rfq_id, rr.id, rr.supplier_company_id, 'sent') returning * into qu;
    update rfq_recipients set status = 'quoted', responded_at = now() where id = rr.id;
    if _rstatus = 'matched' then update rfqs set status = 'quotes_received', updated_at = now() where id = rr.rfq_id; end if;
  else
    if qu.status <> 'negotiating' or (select party from quote_versions where quote_id = qu.id and version = qu.current_version) <> 'buyer' then
      raise exception 'You can revise only after the buyer sends a counter-offer';
    end if;
  end if;
  _v := public._add_quote_version(qu.id, 'supplier', _offer, _profile);
  insert into notifications(company_id, type, title, body, link)
  values (_buyer, 'quote', case when _v = 1 then 'New quote on ' else 'Revised quote on ' end || _num,
    (select name from companies where id = rr.supplier_company_id) || ' sent version ' || _v, '/app/rfqs/' || rr.rfq_id);
  insert into audit_log(entity, entity_id, action, actor_profile_id, data)
  values ('quote', qu.id, case when _v = 1 then 'quote_sent' else 'quote_revised' end, _profile, jsonb_build_object('version', _v));
  return qu.id;
end $$;
revoke all on function public._supplier_offer(uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.supplier_send_quote(_rfq uuid, _offer jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _rec uuid;
begin
  select id into _rec from rfq_recipients where rfq_id = _rfq and supplier_company_id = public.my_company_id();
  if _rec is null then raise exception 'You were not invited to this RFQ'; end if;
  return public._supplier_offer(_rec, _offer, auth.uid());
end $$;
grant execute on function public.supplier_send_quote(uuid, jsonb) to authenticated;

create or replace function public.magic_send_quote(_token text, _offer jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _rec uuid;
begin
  select id into _rec from rfq_recipients where magic_token = _token and length(_token) >= 24;
  if _rec is null then raise exception 'Link not valid'; end if;
  return public._supplier_offer(_rec, _offer, null);
end $$;
grant execute on function public.magic_send_quote(text, jsonb) to anon, authenticated;

-- Quote thread + priceable items for the magic link page.
create or replace function public.magic_quote_state(_token text)
returns json language plpgsql security definer set search_path = public as $$
declare rr rfq_recipients; qu quotes;
begin
  select * into rr from rfq_recipients where magic_token = _token and length(_token) >= 24;
  if rr.id is null then return null; end if;
  select * into qu from quotes where recipient_id = rr.id;
  return json_build_object(
    'items', coalesce((select json_agg(json_build_object('id', i.id, 'description', i.description, 'quantity', i.quantity, 'unit', i.unit) order by i.sort_order)
      from rfq_items i where i.rfq_id = rr.rfq_id), '[]'::json),
    'quote', case when qu.id is null then null else json_build_object('status', qu.status, 'round_count', qu.round_count,
      'round_limit', (select negotiation_round_limit from rfqs where id = rr.rfq_id),
      'versions', (select json_agg(row_to_json(v) order by v.version) from (select version, party, lines, subtotal, delivery_cost, total,
         lead_time_days, delivery_date, valid_until, payment_terms, message, created_at from quote_versions where quote_id = qu.id) v)) end);
end $$;
grant execute on function public.magic_quote_state(text) to anon, authenticated;

create or replace function public.buyer_counter_quote(_quote uuid, _offer jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare qu quotes; _limit int; _v int; _num text;
begin
  select * into qu from quotes where id = _quote;
  if qu.id is null or not public.is_rfq_buyer(qu.rfq_id) then raise exception 'Not your RFQ'; end if;
  if qu.status not in ('sent','negotiating') then raise exception 'This quote is closed'; end if;
  if (select party from quote_versions where quote_id = qu.id and version = qu.current_version) <> 'supplier' then
    raise exception 'Wait for the supplier to answer your counter-offer'; end if;
  select negotiation_round_limit, rfq_number into _limit, _num from rfqs where id = qu.rfq_id;
  if qu.round_count >= _limit then raise exception 'Round limit reached: you can only accept or reject'; end if;
  _v := public._add_quote_version(qu.id, 'buyer', _offer, auth.uid());
  update quotes set status = 'negotiating', round_count = round_count + 1 where id = qu.id;
  update rfqs set status = 'negotiating', updated_at = now() where id = qu.rfq_id and status in ('matched','quotes_received');
  insert into notifications(company_id, type, title, body, link)
  values (qu.supplier_company_id, 'quote', 'Counter-offer on ' || _num, 'The buyer proposed new terms (round ' || (qu.round_count + 1) || ' of ' || _limit || ')', '/supplier/inbox/' || qu.rfq_id);
  insert into audit_log(entity, entity_id, action, actor_profile_id, data) values ('quote', qu.id, 'counter_offer', auth.uid(), jsonb_build_object('version', _v));
  return _v;
end $$;
grant execute on function public.buyer_counter_quote(uuid, jsonb) to authenticated;

create or replace function public.buyer_reject_quote(_quote uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare qu quotes; _num text;
begin
  select * into qu from quotes where id = _quote;
  if qu.id is null or not public.is_rfq_buyer(qu.rfq_id) then raise exception 'Not your RFQ'; end if;
  if qu.status not in ('sent','negotiating') then raise exception 'This quote is closed'; end if;
  update quotes set status = 'rejected', updated_at = now() where id = qu.id;
  update rfq_recipients set status = 'not_selected' where id = qu.recipient_id;
  select rfq_number into _num from rfqs where id = qu.rfq_id;
  insert into notifications(company_id, type, title, body, link)
  values (qu.supplier_company_id, 'quote', 'Quote not selected on ' || _num, coalesce(nullif(left(_reason, 300), ''), 'The buyer rejected your quote'), '/supplier/inbox/' || qu.rfq_id);
  insert into audit_log(entity, entity_id, action, actor_profile_id, data) values ('quote', qu.id, 'rejected_by_buyer', auth.uid(), jsonb_build_object('reason', _reason));
end $$;
grant execute on function public.buyer_reject_quote(uuid, text) to authenticated;

create or replace function public.supplier_reject_counter(_rfq uuid)
returns void language plpgsql security definer set search_path = public as $$
declare qu quotes; _buyer uuid; _num text;
begin
  select * into qu from quotes where rfq_id = _rfq and supplier_company_id = public.my_company_id();
  if qu.id is null or qu.status <> 'negotiating' then raise exception 'No open counter-offer'; end if;
  update quotes set status = 'rejected', updated_at = now() where id = qu.id;
  select buyer_company_id, rfq_number into _buyer, _num from rfqs where id = _rfq;
  insert into notifications(company_id, type, title, body, link)
  values (_buyer, 'quote', 'Counter-offer declined on ' || _num, (select name from companies where id = qu.supplier_company_id) || ' declined your counter-offer', '/app/rfqs/' || _rfq);
  insert into audit_log(entity, entity_id, action, actor_profile_id, data) values ('quote', qu.id, 'counter_rejected', auth.uid(), '{}');
end $$;
grant execute on function public.supplier_reject_counter(uuid) to authenticated;