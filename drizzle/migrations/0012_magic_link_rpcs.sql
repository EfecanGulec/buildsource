-- Magic link (/q/:token) for unclaimed suppliers: the secret token is the only credential,
-- so every function resolves it to exactly one invite and exposes only that invite's RFQ.
create or replace function public.magic_get(_token text)
returns json language plpgsql security definer set search_path = public as $$
declare rr rfq_recipients; res json;
begin
  select * into rr from rfq_recipients where magic_token = _token and length(_token) >= 24;
  if rr.id is null then return null; end if;
  update rfq_recipients set viewed_at = coalesce(viewed_at, now()),
    status = case when status = 'sent' then 'viewed'::recipient_status else status end where id = rr.id;
  select json_build_object(
    'status', (select status from rfq_recipients where id = rr.id),
    'supplier', (select json_build_object('name', name, 'is_claimed', is_claimed) from companies where id = rr.supplier_company_id),
    'has_quote', exists(select 1 from quotes where recipient_id = rr.id),
    'rfq', (select json_build_object('rfq_number', f.rfq_number, 'title', f.title, 'description', f.description,
        'project_type', f.project_type, 'delivery_city', f.delivery_city, 'delivery_week', f.delivery_week,
        'delivery_date_requested', f.delivery_date_requested, 'buyer', c.name)
        from rfqs f join companies c on c.id = f.buyer_company_id where f.id = rr.rfq_id),
    'items', coalesce((select json_agg(json_build_object('description', i.description, 'specs', i.specs, 'quantity', i.quantity,
        'unit', i.unit, 'standard', i.standard, 'waste_pct', i.waste_pct, 'category', cat.name_en) order by i.sort_order)
        from rfq_items i left join categories cat on cat.id = i.category_id where i.rfq_id = rr.rfq_id), '[]'::json),
    'messages', coalesce((select json_agg(json_build_object('body', m.body, 'party', m.sender_party, 'at', m.created_at) order by m.created_at)
        from messages m where m.recipient_id = rr.id), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.magic_ask(_token text, _body text)
returns void language plpgsql security definer set search_path = public as $$
declare rr rfq_recipients; _buyer uuid; _num text;
begin
  select * into rr from rfq_recipients where magic_token = _token and length(_token) >= 24;
  if rr.id is null or rr.status in ('declined','rerouted','expired') then raise exception 'Link not active'; end if;
  if length(trim(coalesce(_body,''))) = 0 or length(_body) > 2000 then raise exception 'Message must be 1-2000 characters'; end if;
  insert into messages(rfq_id, recipient_id, sender_party, body) values (rr.rfq_id, rr.id, 'supplier', trim(_body));
  select buyer_company_id, rfq_number into _buyer, _num from rfqs where id = rr.rfq_id;
  insert into notifications(company_id, type, title, body, link)
  values (_buyer, 'message', 'Question on ' || _num, left(trim(_body), 140), '/app/rfqs/' || rr.rfq_id);
end $$;

create or replace function public.magic_decline(_token text, _reason decline_reason, _message text)
returns void language plpgsql security definer set search_path = public as $$
declare rr rfq_recipients; _buyer uuid; _num text; _name text;
begin
  select * into rr from rfq_recipients where magic_token = _token and length(_token) >= 24;
  if rr.id is null or rr.status not in ('sent','viewed') then raise exception 'Nothing to decline'; end if;
  update rfq_recipients set status = 'declined', decline_reason = _reason,
    decline_message = nullif(left(trim(coalesce(_message,'')), 1000), ''), responded_at = now() where id = rr.id;
  select buyer_company_id, rfq_number into _buyer, _num from rfqs where id = rr.rfq_id;
  select name into _name from companies where id = rr.supplier_company_id;
  insert into notifications(company_id, type, title, body, link)
  values (_buyer, 'declined', _name || ' declined ' || _num, _reason::text, '/app/rfqs/' || rr.rfq_id);
  perform reroute_rfq(rr.rfq_id);
end $$;

grant execute on function public.magic_get(text), public.magic_ask(text,text), public.magic_decline(text,decline_reason,text) to anon, authenticated;