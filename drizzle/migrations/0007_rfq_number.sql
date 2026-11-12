alter table public.rfqs alter column rfq_number set default '';
create or replace function public.set_rfq_number() returns trigger
language plpgsql security definer set search_path = public
as $$
declare y text := to_char(now(), 'YYYY'); n int;
begin
  if coalesce(new.rfq_number, '') = '' then
    perform pg_advisory_xact_lock(hashtext('rfq_number_' || y));
    select coalesce(max(split_part(rfq_number, '-', 3)::int), 0) + 1 into n
      from public.rfqs where rfq_number like 'RFQ-' || y || '-%';
    new.rfq_number := 'RFQ-' || y || '-' || lpad(n::text, 4, '0');
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;
revoke execute on function public.set_rfq_number() from public, anon, authenticated;
create trigger rfqs_set_number before insert on public.rfqs for each row execute function public.set_rfq_number();