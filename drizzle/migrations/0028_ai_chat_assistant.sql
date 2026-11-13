alter table public.messages add column if not exists is_ai boolean not null default false;

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  rfq_id uuid not null,
  recipient_id uuid not null,
  scope text not null check (scope in ('private','shared')),
  created_at timestamptz not null default now(),
  unique (profile_id, recipient_id, scope)
);
grant select, insert on public.ai_conversations to authenticated;
grant all on public.ai_conversations to service_role;
alter table public.ai_conversations enable row level security;
create policy "own ai conversations read" on public.ai_conversations for select to authenticated using (profile_id = auth.uid());
create policy "own ai conversations insert" on public.ai_conversations for insert to authenticated with check (profile_id = auth.uid());

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  profile_id uuid not null,
  role text not null check (role in ('user','assistant','tool')),
  content text not null,
  tool_calls jsonb,
  tokens int,
  created_at timestamptz not null default now()
);
create index on public.ai_messages (profile_id, created_at);
grant select, insert on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;
alter table public.ai_messages enable row level security;
create policy "own ai messages read" on public.ai_messages for select to authenticated using (profile_id = auth.uid());
create policy "own ai messages insert" on public.ai_messages for insert to authenticated with check (
  profile_id = auth.uid() and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.profile_id = auth.uid()));

-- Clients may never mark their own message as AI.
create or replace function public.messages_no_fake_ai() returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_ai and auth.uid() is not null then raise exception 'Only the platform can post AI messages'; end if;
  return new;
end $$;
create trigger messages_no_fake_ai before insert or update on public.messages for each row execute function public.messages_no_fake_ai();