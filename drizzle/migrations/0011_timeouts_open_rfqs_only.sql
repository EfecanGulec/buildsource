create or replace function public.process_rfq_timeouts(_offset interval default '0'::interval)
returns json language plpgsql security definer set search_path = public as $$
declare r record; _rem int := 0; _rer int := 0;
begin
  update rfq_recipients rr set reminder_sent_at = now()
   from rfqs f where f.id = rr.rfq_id and f.status in ('matched','quotes_received','negotiating')
     and rr.status in ('sent','viewed') and rr.reminder_sent_at is null and rr.sent_at + interval '24 hours' <= now() + _offset;
  get diagnostics _rem = row_count;
  for r in select rr.id, rr.rfq_id from rfq_recipients rr join rfqs f on f.id = rr.rfq_id
            where f.status in ('matched','quotes_received','negotiating')
              and rr.status in ('sent','viewed') and rr.sent_at + interval '48 hours' <= now() + _offset
              and not exists (select 1 from quotes q where q.recipient_id = rr.id) loop
    update rfq_recipients set status = 'rerouted' where id = r.id;
    perform reroute_rfq(r.rfq_id);
    _rer := _rer + 1;
  end loop;
  return json_build_object('reminders', _rem, 'rerouted', _rer);
end $$;
revoke all on function public.process_rfq_timeouts(interval) from public, anon, authenticated;