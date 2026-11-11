create type public.app_role as enum ('buyer', 'supplier', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  company_code text,
  country text default 'Lithuania',
  city text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- One-time self-selection of account type (buyer or supplier only)
create or replace function public.choose_account_type(_role app_role)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _role not in ('buyer','supplier') then raise exception 'Invalid account type'; end if;
  if exists (select 1 from public.user_roles where user_id = auth.uid()) then
    raise exception 'Account type already chosen';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), _role);
end $$;
revoke execute on function public.choose_account_type(app_role) from public, anon;
grant execute on function public.choose_account_type(app_role) to authenticated;

create or replace function public.update_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare _type text := new.raw_user_meta_data->>'account_type';
begin
  insert into public.profiles (id, full_name, company_name)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'company_name');
  if _type in ('buyer','supplier') then
    insert into public.user_roles (user_id, role) values (new.id, _type::app_role);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();