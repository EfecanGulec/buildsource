create or replace function public._invite_supplier(_rfq uuid, _supplier uuid, _score numeric, _rank int, _claimed boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare _num text; _title text;
begin
  insert into rfq_recipients(rfq_id, supplier_company_id, match_score, rank, status, sent_at, magic_token)
  values (_rfq, _supplier, _score, _rank, 'sent', now(),
          case when _claimed then null else encode(extensions.gen_random_bytes(18),'hex') end);
  select rfq_number, title into _num, _title from rfqs where id = _rfq;
  insert into notifications(company_id, type, title, body, link)
  values (_supplier, 'new_rfq', 'New RFQ ' || _num, _title, '/supplier/inbox/' || _rfq);
end $$;
revoke all on function public._invite_supplier(uuid,uuid,numeric,int,boolean) from public, anon, authenticated;