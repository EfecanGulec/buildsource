-- Chat (spec 7.3): every message is checked and tagged server-side.
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare _rfq uuid;
begin
  select rfq_id into _rfq from rfq_recipients where id = new.recipient_id;
  if _rfq is null or _rfq <> new.rfq_id then raise exception 'Message thread does not belong to this RFQ'; end if;
  new.body := trim(new.body);
  if length(new.body) = 0 or length(new.body) > 2000 then raise exception 'Message must be 1-2000 characters'; end if;
  new.quote_id := coalesce(new.quote_id, (select id from quotes where recipient_id = new.recipient_id));
  -- Contact details before an order exists: flag (soft warning), do not block.
  if not exists (select 1 from orders where rfq_id = new.rfq_id) then
    new.contains_contact_info := new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
      or regexp_replace(new.body, '[^0-9+]', '', 'g') ~ '\+?[0-9]{8,}';
  else
    new.contains_contact_info := false;
  end if;
  return new;
end $$;
create trigger messages_check before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare _buyer uuid; _num text; _sup uuid;
begin
  if auth.uid() is null then return new; end if; -- magic link path notifies itself
  select buyer_company_id, rfq_number into _buyer, _num from rfqs where id = new.rfq_id;
  select supplier_company_id into _sup from rfq_recipients where id = new.recipient_id;
  insert into notifications(company_id, type, title, body, link)
  values (case when new.sender_party = 'buyer' then _sup else _buyer end, 'message', 'New message on ' || _num, left(new.body, 140),
    case when new.sender_party = 'buyer' then '/supplier/inbox/' else '/app/rfqs/' end || new.rfq_id);
  return new;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.messages_notify();

-- Quote expiry: open quotes whose latest version is past valid_until become expired.
create or replace function public.expire_stale_quotes()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update quotes q set status = 'expired', updated_at = now()
  from quote_versions v
  where v.quote_id = q.id and v.version = q.current_version and q.status in ('sent','negotiating')
    and v.valid_until is not null and v.valid_until < current_date;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.expire_stale_quotes() to anon, authenticated;