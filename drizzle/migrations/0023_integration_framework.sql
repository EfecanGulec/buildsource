-- lovable-cron-fallback-reviewed: pool deadlines and 24h/48h RFQ timeouts are purely time-based; one consolidated 5-min tick also drains the retry queue (no separate sweeper).
create extension if not exists pg_cron;

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  service text not null unique check (service in ('identity','payments','financing','company_data','places','email','whatsapp','sms','carrier','catalog','ai','translation')),
  provider text not null,
  mode text not null default 'demo' check (mode in ('demo','live')),
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  last_success_at timestamptz, last_error text,
  updated_at timestamptz not null default now()
);
grant select on public.integrations to authenticated;
grant all on public.integrations to service_role;
alter table public.integrations enable row level security;
create policy "admins read integrations" on public.integrations for select to authenticated using (public.is_admin());

create table public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  service text not null, provider text, action text not null,
  request_summary jsonb not null default '{}'::jsonb,
  response_status int, duration_ms int, error text,
  created_at timestamptz not null default now()
);
grant select on public.integration_logs to authenticated;
grant all on public.integration_logs to service_role;
alter table public.integration_logs enable row level security;
create policy "admins read integration logs" on public.integration_logs for select to authenticated using (public.is_admin());

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null, event_type text not null, external_id text unique,
  payload jsonb not null default '{}'::jsonb, signature_valid boolean not null default false,
  processed_at timestamptz, error text, created_at timestamptz not null default now()
);
grant select on public.webhook_events to authenticated;
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;
create policy "admins read webhooks" on public.webhook_events for select to authenticated using (public.is_admin());

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('company_data_import','feed_import','tracking_poll','trust_recompute','pool_close','rfq_timeouts','quote_expiry')),
  target_id uuid, status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0, run_after timestamptz not null default now(),
  result jsonb, created_at timestamptz not null default now()
);
create index sync_jobs_due on public.sync_jobs (status, run_after);
grant select on public.sync_jobs to authenticated;
grant all on public.sync_jobs to service_role;
alter table public.sync_jobs enable row level security;
create policy "admins read jobs" on public.sync_jobs for select to authenticated using (public.is_admin());

create table public.identity_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('login','verify','sign_agreement','claim_company','confirm_pool')),
  provider_session_id text, verification_code text, status text not null default 'pending',
  result_personal_code_hash text, expires_at timestamptz, created_at timestamptz not null default now()
);
grant select on public.identity_sessions to authenticated;
grant all on public.identity_sessions to service_role;
alter table public.identity_sessions enable row level security;
create policy "own identity sessions" on public.identity_sessions for select to authenticated using (profile_id = auth.uid() or public.is_admin());

create table public.provider_accounts (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null, provider_account_id text,
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending','verified','restricted')),
  payouts_enabled boolean not null default false, updated_at timestamptz not null default now(),
  primary key (company_id, provider)
);
grant select on public.provider_accounts to authenticated;
grant all on public.provider_accounts to service_role;
alter table public.provider_accounts enable row level security;
create policy "own provider accounts" on public.provider_accounts for select to authenticated using (company_id = public.my_company_id() or public.is_admin());

alter table public.payments add column if not exists provider_payment_id text,
  add column if not exists provider_transfer_id text,
  add column if not exists provider_refund_id text,
  add column if not exists platform_fee_cents bigint;

create or replace function public.admin_set_integration(_service text, _mode text, _enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if _mode not in ('demo','live') then raise exception 'Bad mode'; end if;
  update integrations set mode = _mode, is_enabled = coalesce(_enabled, is_enabled), updated_at = now() where service = _service;
  insert into integration_logs(service, provider, action, request_summary)
    select service, provider, 'set_mode', jsonb_build_object('mode', _mode, 'enabled', is_enabled, 'by', auth.uid()) from integrations where service = _service;
end $$;
revoke execute on function public.admin_set_integration(text,text,boolean) from public, anon;
grant execute on function public.admin_set_integration(text,text,boolean) to authenticated;

create or replace function public.job_backoff(_attempts int) returns interval
language sql immutable set search_path = public as $$
  select case when _attempts <= 1 then interval '1 minute' when _attempts = 2 then interval '5 minutes'
              when _attempts = 3 then interval '30 minutes' else interval '2 hours' end
$$;

create or replace function public.enqueue_job(_job text, _target uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;
  insert into sync_jobs(job, target_id) values (_job, _target) returning id into _id;
  return _id;
end $$;
revoke execute on function public.enqueue_job(text,uuid) from public, anon;
grant execute on function public.enqueue_job(text,uuid) to authenticated;

create or replace function public._exec_job(_job text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  case _job
    when 'pool_close' then return jsonb_build_object('pools', process_pools());
    when 'rfq_timeouts' then return to_jsonb(process_rfq_timeouts());
    when 'quote_expiry' then return jsonb_build_object('expired', expire_stale_quotes());
    when 'trust_recompute' then return jsonb_build_object('companies', recompute_all_scores());
    else raise exception 'Job % has no runner yet', _job;
  end case;
end $$;
revoke execute on function public._exec_job(text) from public, anon, authenticated;

create or replace function public.run_sync_jobs() returns int
language plpgsql security definer set search_path = public as $$
declare j record; n int := 0; _res jsonb;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;
  for j in select * from sync_jobs where status = 'queued' and run_after <= now() order by run_after limit 50 for update skip locked loop
    update sync_jobs set status = 'running', attempts = attempts + 1 where id = j.id;
    begin
      _res := _exec_job(j.job);
      update sync_jobs set status = 'done', result = _res where id = j.id;
    exception when others then
      if j.attempts + 1 >= 5 then
        update sync_jobs set status = 'failed', result = jsonb_build_object('error', sqlerrm) where id = j.id;
        insert into integration_logs(service, action, error) values ('scheduler', 'job_failed:' || j.job, sqlerrm);
      else
        update sync_jobs set status = 'queued', run_after = now() + job_backoff(j.attempts + 1),
          result = jsonb_build_object('error', sqlerrm) where id = j.id;
      end if;
    end;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.run_sync_jobs() from public, anon;
grant execute on function public.run_sync_jobs() to authenticated;

create or replace function public.scheduler_tick(_jobs text[]) returns int
language plpgsql security definer set search_path = public as $$
begin
  insert into sync_jobs(job) select unnest(_jobs);
  return run_sync_jobs();
end $$;
revoke execute on function public.scheduler_tick(text[]) from public, anon, authenticated;

select cron.schedule('bs-every-5-min', '*/5 * * * *', $c$select public.scheduler_tick(array['pool_close','rfq_timeouts','quote_expiry'])$c$);
select cron.schedule('bs-trust-nightly', '0 3 * * *', $c$select public.scheduler_tick(array['trust_recompute'])$c$);