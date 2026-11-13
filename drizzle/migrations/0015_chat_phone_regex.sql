create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare _rfq uuid;
begin
  select rfq_id into _rfq from rfq_recipients where id = new.recipient_id;
  if _rfq is null or _rfq <> new.rfq_id then raise exception 'Message thread does not belong to this RFQ'; end if;
  new.body := trim(new.body);
  if length(new.body) = 0 or length(new.body) > 2000 then raise exception 'Message must be 1-2000 characters'; end if;
  new.quote_id := coalesce(new.quote_id, (select id from quotes where recipient_id = new.recipient_id));
  if not exists (select 1 from orders where rfq_id = new.rfq_id) then
    new.contains_contact_info := new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
      or new.body ~ '(^|[^0-9])\+?[0-9]( ?[0-9]){7,}';
  else
    new.contains_contact_info := false;
  end if;
  return new;
end $$;