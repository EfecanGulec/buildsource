create type public.company_type as enum ('buyer','supplier');
create type public.buyer_segment as enum ('contractor','designer','business');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  type public.company_type not null,
  name text not null,
  company_code text not null unique,
  vat_code text,
  country text not null default 'LT',
  city text,
  address text,
  buyer_segment public.buyer_segment,
  is_claimed boolean not null default false,
  claimed_at timestamptz,
  bank_account_iban text,
  bank_account_verified boolean not null default false,
  logo_url text,
  website text,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;

alter table public.profiles
  add column company_id uuid references public.companies(id) on delete set null,
  add column email text,
  add column language text not null default 'en',
  add column smart_id_verified boolean not null default false,
  add column smart_id_verified_at timestamptz;

create policy "Members read own company" on public.companies for select to authenticated
  using (id = (select company_id from public.profiles where profiles.id = auth.uid()));

create trigger companies_updated_at before update on public.companies
for each row execute function public.update_updated_at();

-- Users may only edit personal fields; company link and verification go through functions.
revoke insert, update on public.profiles from authenticated;
grant insert (id, full_name, phone, language, email) on public.profiles to authenticated;
grant update (full_name, phone, language) on public.profiles to authenticated;

create or replace function public.save_my_company(
  _name text, _company_code text, _city text, _country text default 'LT',
  _buyer_segment public.buyer_segment default null
) returns uuid language plpgsql security definer set search_path = public
as $$
declare _uid uuid := auth.uid(); _role app_role; _cid uuid; _existing uuid;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  select role into _role from public.user_roles where user_id = _uid and role in ('buyer','supplier') limit 1;
  if _role is null then raise exception 'Choose buyer or supplier first'; end if;
  if coalesce(trim(_name),'') = '' or coalesce(trim(_company_code),'') = '' then
    raise exception 'Company name and company code are required';
  end if;
  if _role = 'buyer' and _buyer_segment is null then raise exception 'Choose a buyer segment'; end if;
  select company_id into _cid from public.profiles where id = _uid;
  select id into _existing from public.companies where company_code = trim(_company_code);
  if _existing is not null and _existing is distinct from _cid then
    raise exception 'A company with this company code is already registered';
  end if;
  if _cid is null then
    insert into public.companies (type, name, company_code, city, country, buyer_segment, created_by, is_claimed, claimed_at)
    values (_role::text::company_type, trim(_name), trim(_company_code), _city, coalesce(_country,'LT'),
            case when _role = 'buyer' then _buyer_segment end, _uid, _role = 'supplier', case when _role = 'supplier' then now() end)
    returning id into _cid;
  else
    update public.companies set name = trim(_name), company_code = trim(_company_code), city = _city,
      country = coalesce(_country,'LT'), buyer_segment = case when _role = 'buyer' then _buyer_segment end
    where id = _cid;
  end if;
  insert into public.profiles (id, company_id, company_name, company_code, city)
  values (_uid, _cid, trim(_name), trim(_company_code), _city)
  on conflict (id) do update set company_id = excluded.company_id, company_name = excluded.company_name,
    company_code = excluded.company_code, city = excluded.city;
  return _cid;
end $$;
revoke execute on function public.save_my_company(text,text,text,text,public.buyer_segment) from public, anon;
grant execute on function public.save_my_company(text,text,text,text,public.buyer_segment) to authenticated;

-- Demo Smart-ID: the demo connector confirms on the client after 2 s; live mode will verify server-side.
create or replace function public.mark_smart_id_verified()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.profiles set smart_id_verified = true, smart_id_verified_at = now() where id = auth.uid();
end $$;
revoke execute on function public.mark_smart_id_verified() from public, anon;
grant execute on function public.mark_smart_id_verified() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  _type text := new.raw_user_meta_data->>'account_type';
  _code text := nullif(trim(new.raw_user_meta_data->>'company_code'),'');
  _name text := nullif(trim(new.raw_user_meta_data->>'company_name'),'');
  _seg text := new.raw_user_meta_data->>'buyer_segment';
  _cid uuid;
begin
  if _type in ('buyer','supplier') and _code is not null and _name is not null
     and not exists (select 1 from public.companies where company_code = _code) then
    insert into public.companies (type, name, company_code, buyer_segment, created_by, is_claimed, claimed_at)
    values (_type::company_type, _name, _code,
      case when _type = 'buyer' and _seg in ('contractor','designer','business') then _seg::buyer_segment end,
      new.id, _type = 'supplier', case when _type = 'supplier' then now() end)
    returning id into _cid;
  end if;
  insert into public.profiles (id, full_name, company_name, company_code, email, company_id)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    _name, _code, new.email, _cid);
  if _type in ('buyer','supplier') then
    insert into public.user_roles (user_id, role) values (new.id, _type::app_role);
  end if;
  return new;
end $$;