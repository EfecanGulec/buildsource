create type public.project_type as enum ('new_construction','renovation','interior_design','business_fitout');
create type public.rfq_status as enum ('draft','submitted','matched','quotes_received','negotiating','closed','cancelled');
create type public.recipient_status as enum ('sent','viewed','declined','quoted','expired','rerouted','not_selected','selected');
create type public.quote_status as enum ('draft','sent','negotiating','accepted','rejected','expired','withdrawn');
create type public.offer_party as enum ('buyer','supplier');
create type public.order_status as enum ('created','awaiting_payment','paid_escrow','processing','shipped','in_transit','delivered','accepted','disputed','completed','cancelled');
create type public.payment_status as enum ('pending','held','partially_released','released','refunded','failed');
create type public.payment_method as enum ('escrow','pay_later');
create type public.dispute_status as enum ('open','resolved_replacement','resolved_partial_refund','resolved_full_refund','rejected');
create type public.pool_status as enum ('open','closed','confirming','ordered','cancelled');
create type public.pool_member_status as enum ('joined','left','confirmed','declined','no_response');
create type public.decline_reason as enum ('out_of_stock','cannot_meet_date','order_too_small','not_our_product','other');

alter table public.companies add column is_demo boolean not null default false;

create table public.company_public_data (
  company_id uuid primary key references public.companies(id) on delete cascade,
  registered_date date, status text not null default 'active' check (status in ('active','bankrupt','liquidation')),
  activity_codes text[] not null default '{}', employees int, avg_wage numeric,
  sodra_debt boolean not null default false, tax_debt boolean not null default false, vat_valid boolean not null default true,
  tender_wins int not null default 0, data_date date default current_date
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete cascade,
  slug text not null unique, name_en text not null, name_lt text,
  "group" text not null check ("group" in ('build','fitout')),
  field_template jsonb not null default '[]', default_unit text,
  commission_group text not null default 'materials' check (commission_group in ('materials','furniture_equipment')),
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create table public.supplier_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  regions_served text[] not null default '{}', warehouse_locations jsonb not null default '[]',
  min_order_eur numeric not null default 0, typical_lead_time_days int, weekly_capacity jsonb not null default '{}',
  certificates jsonb not null default '[]', installation_offered boolean not null default false, warranty_months int,
  service_area text[] not null default '{}', response_rate numeric, avg_response_hours numeric, on_time_rate numeric,
  avg_rating numeric, review_count int not null default 0, disputes_lost int not null default 0,
  pro_subscription boolean not null default false, product_feed_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.supplier_categories (
  supplier_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (supplier_id, category_id)
);
create table public.trust_scores (
  company_id uuid primary key references public.companies(id) on delete cascade,
  score int not null check (score between 0 and 100), breakdown jsonb not null default '{}',
  public_data_date date, computed_at timestamptz not null default now()
);
create table public.kits (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  project_type public.project_type not null, items jsonb not null default '[]', created_at timestamptz not null default now()
);
create table public.buyer_reliability (
  company_id uuid primary key references public.companies(id) on delete cascade,
  score int not null default 70, rfqs_created int not null default 0, orders_completed int not null default 0,
  pool_no_shows int not null default 0, late_confirmations int not null default 0
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, project_type public.project_type not null, city text, address text, notes text,
  created_at timestamptz not null default now()
);
create table public.rfqs (
  id uuid primary key default gen_random_uuid(), rfq_number text not null unique,
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  project_type public.project_type not null, title text not null, description text,
  delivery_city text, delivery_address text, delivery_date_requested date, delivery_week text,
  status public.rfq_status not null default 'draft',
  source text not null default 'manual' check (source in ('manual','snap_source','kit')),
  ai_upload_urls text[] not null default '{}', min_trust_score int not null default 40,
  max_suppliers int not null default 5, negotiation_round_limit int not null default 3,
  submitted_at timestamptz, closed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null, specs jsonb not null default '{}', quantity numeric not null default 1, unit text,
  standard text, waste_pct numeric not null default 0, ai_confidence numeric, buyer_confirmed boolean not null default false,
  sort_order int not null default 0
);
create table public.rfq_recipients (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  match_score numeric, rank int, status public.recipient_status not null default 'sent',
  magic_token text unique, sent_at timestamptz default now(), viewed_at timestamptz, responded_at timestamptz,
  decline_reason public.decline_reason, decline_message text, reminder_sent_at timestamptz,
  unique (rfq_id, supplier_company_id)
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  status public.quote_status not null default 'draft', current_version int not null default 0,
  round_count int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (rfq_id, supplier_company_id)
);
create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version int not null, party public.offer_party not null, lines jsonb not null default '[]',
  subtotal numeric not null default 0, delivery_cost numeric not null default 0, total numeric not null default 0,
  lead_time_days int, delivery_date date, warehouse_origin text, valid_until date, payment_terms text,
  certificates jsonb not null default '[]', attachments text[] not null default '{}', message text,
  images text[] not null default '{}', drawing_url text, sample_available boolean,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), unique (quote_id, version)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  recipient_id uuid not null references public.rfq_recipients(id) on delete cascade,
  sender_party public.offer_party not null, sender_profile_id uuid references public.profiles(id) on delete set null,
  body text not null, attachments text[] not null default '{}', translated_body text,
  contains_contact_info boolean not null default false,
  created_at timestamptz not null default now(), read_at timestamptz
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  total numeric not null, lead_time_days int, delivery_date date, payment_terms text,
  buyer_signed_at timestamptz, buyer_signature_code text, supplier_signed_at timestamptz, supplier_signature_code text,
  status text not null default 'pending' check (status in ('pending','signed','cancelled')),
  created_at timestamptz not null default now()
);
create table public.group_buy_pools (
  id uuid primary key default gen_random_uuid(),
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  product_name text not null, product_specs jsonb not null default '{}', images text[] not null default '{}',
  datasheet_url text, certificates jsonb not null default '[]', unit text not null default 'pcs',
  base_price numeric not null, tiers jsonb not null default '[]', region text, delivery_week text,
  deadline timestamptz, min_qty numeric not null default 0, confirm_window_hours int not null default 24,
  keep_tier_threshold numeric not null default 0.8, status public.pool_status not null default 'open',
  closed_qty numeric, final_discount_pct numeric, final_unit_price numeric,
  created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  agreement_id uuid references public.agreements(id) on delete set null,
  rfq_id uuid references public.rfqs(id) on delete set null,
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  pool_id uuid references public.group_buy_pools(id) on delete set null,
  total numeric not null, commission_rate numeric not null default 0, commission_amount numeric not null default 0,
  supplier_payout numeric not null default 0, payment_method public.payment_method not null default 'escrow',
  status public.order_status not null default 'created', staged_payment boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.group_buy_pools(id) on delete cascade,
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  rfq_id uuid references public.rfqs(id) on delete set null, quantity numeric not null check (quantity > 0),
  if_pool_fails text not null default 'order_alone' check (if_pool_fails in ('order_alone','cancel')),
  status public.pool_member_status not null default 'joined',
  joined_at timestamptz not null default now(), confirmed_at timestamptz,
  order_id uuid references public.orders(id) on delete set null
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  milestone text not null default 'full' check (milestone in ('full','drawing_approval','delivery')),
  amount numeric not null, status public.payment_status not null default 'pending',
  provider text not null default 'demo_escrow' check (provider in ('demo_escrow','demo_financing')),
  held_at timestamptz, released_at timestamptz, refunded_amount numeric not null default 0,
  created_at timestamptz not null default now()
);
create table public.financing_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_company_id uuid not null references public.companies(id) on delete cascade,
  amount numeric not null, term_days int not null check (term_days in (30,60)),
  status text not null default 'approved' check (status in ('approved','rejected','repaid')),
  partner_fee_rate numeric, decided_at timestamptz, created_at timestamptz not null default now()
);
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null, note text, photo_urls text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table public.production_milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null check (name in ('drawing_approved','sample_approved','in_production','ready')),
  photo_urls text[] not null default '{}', approved_by_buyer boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  opened_by uuid references public.profiles(id) on delete set null, reason text not null, description text,
  photo_urls text[] not null default '{}', held_amount numeric not null default 0,
  status public.dispute_status not null default 'open', resolution_note text,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  reviewer_company_id uuid not null references public.companies(id) on delete cascade,
  supplier_company_id uuid not null references public.companies(id) on delete cascade,
  rating int not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  type text not null, title text not null, body text, link text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), entity text not null, entity_id uuid, action text not null,
  actor_profile_id uuid, data jsonb not null default '{}', created_at timestamptz not null default now()
);

create index on public.rfqs (buyer_company_id);
create index on public.rfq_items (rfq_id);
create index on public.rfq_recipients (supplier_company_id);
create index on public.quotes (supplier_company_id);
create index on public.quote_versions (quote_id);
create index on public.messages (recipient_id);
create index on public.orders (buyer_company_id);
create index on public.orders (supplier_company_id);
create index on public.pool_members (pool_id);
create index on public.notifications (profile_id);

grant select on public.company_public_data, public.categories, public.supplier_profiles, public.supplier_categories,
  public.trust_scores, public.kits, public.buyer_reliability, public.reviews, public.group_buy_pools to authenticated;
grant select, insert, update, delete on public.projects, public.rfqs, public.rfq_items, public.pool_members to authenticated;
grant select, insert, update on public.quotes, public.rfq_recipients to authenticated;
grant select, insert on public.quote_versions, public.messages, public.disputes to authenticated;
grant select on public.agreements, public.orders, public.payments, public.financing_requests, public.order_events,
  public.production_milestones to authenticated;
grant insert on public.reviews to authenticated;
grant insert, update, delete on public.group_buy_pools, public.supplier_categories to authenticated;
grant update on public.supplier_profiles to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_log to authenticated;
grant all on public.company_public_data, public.categories, public.supplier_profiles, public.supplier_categories,
  public.trust_scores, public.kits, public.buyer_reliability, public.projects, public.rfqs, public.rfq_items,
  public.rfq_recipients, public.quotes, public.quote_versions, public.messages, public.agreements, public.orders,
  public.payments, public.financing_requests, public.order_events, public.production_milestones, public.disputes,
  public.reviews, public.group_buy_pools, public.pool_members, public.notifications, public.audit_log to service_role;

create or replace function public.my_company_id() returns uuid language sql stable security definer set search_path = public
as $$ select company_id from public.profiles where id = auth.uid() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin') $$;
create or replace function public.is_rfq_buyer(_rfq uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.rfqs where id = _rfq and buyer_company_id = public.my_company_id()) $$;
create or replace function public.is_rfq_supplier(_rfq uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.rfq_recipients where rfq_id = _rfq and supplier_company_id = public.my_company_id()) $$;
create or replace function public.is_order_party(_order uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.orders where id = _order and public.my_company_id() in (buyer_company_id, supplier_company_id)) $$;
create or replace function public.quote_supplier(_quote uuid) returns uuid language sql stable security definer set search_path = public
as $$ select supplier_company_id from public.quotes where id = _quote $$;
create or replace function public.quote_rfq(_quote uuid) returns uuid language sql stable security definer set search_path = public
as $$ select rfq_id from public.quotes where id = _quote $$;
create or replace function public.recipient_supplier(_rec uuid) returns uuid language sql stable security definer set search_path = public
as $$ select supplier_company_id from public.rfq_recipients where id = _rec $$;
create or replace function public.pool_owner(_pool uuid) returns uuid language sql stable security definer set search_path = public
as $$ select supplier_company_id from public.group_buy_pools where id = _pool $$;
create or replace function public.pool_joined_qty(_pool uuid) returns numeric language sql stable security definer set search_path = public
as $$ select coalesce(sum(quantity),0) from public.pool_members where pool_id = _pool and status in ('joined','confirmed') $$;
revoke execute on function public.my_company_id(), public.is_admin(), public.is_rfq_buyer(uuid), public.is_rfq_supplier(uuid),
  public.is_order_party(uuid), public.quote_supplier(uuid), public.quote_rfq(uuid), public.recipient_supplier(uuid),
  public.pool_owner(uuid), public.pool_joined_qty(uuid) from public, anon;
grant execute on function public.my_company_id(), public.is_admin(), public.is_rfq_buyer(uuid), public.is_rfq_supplier(uuid),
  public.is_order_party(uuid), public.quote_supplier(uuid), public.quote_rfq(uuid), public.recipient_supplier(uuid),
  public.pool_owner(uuid), public.pool_joined_qty(uuid) to authenticated;

alter table public.company_public_data enable row level security;
alter table public.categories enable row level security;
alter table public.supplier_profiles enable row level security;
alter table public.supplier_categories enable row level security;
alter table public.trust_scores enable row level security;
alter table public.kits enable row level security;
alter table public.buyer_reliability enable row level security;
alter table public.projects enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_items enable row level security;
alter table public.rfq_recipients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.messages enable row level security;
alter table public.agreements enable row level security;
alter table public.orders enable row level security;
alter table public.pool_members enable row level security;
alter table public.group_buy_pools enable row level security;
alter table public.payments enable row level security;
alter table public.financing_requests enable row level security;
alter table public.order_events enable row level security;
alter table public.production_milestones enable row level security;
alter table public.disputes enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

create policy "Signed-in read suppliers" on public.companies for select to authenticated using (type = 'supplier');
create policy "Suppliers read inviting buyers" on public.companies for select to authenticated
  using (exists (select 1 from public.rfqs r join public.rfq_recipients rr on rr.rfq_id = r.id
    where r.buyer_company_id = companies.id and rr.supplier_company_id = public.my_company_id()));
create policy "Admin all companies" on public.companies for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Read" on public.company_public_data for select to authenticated using (true);
create policy "Read" on public.categories for select to authenticated using (true);
create policy "Read" on public.supplier_profiles for select to authenticated using (true);
create policy "Read" on public.supplier_categories for select to authenticated using (true);
create policy "Read" on public.trust_scores for select to authenticated using (true);
create policy "Read" on public.kits for select to authenticated using (true);
create policy "Read" on public.buyer_reliability for select to authenticated using (true);
create policy "Read" on public.reviews for select to authenticated using (true);
create policy "Read" on public.group_buy_pools for select to authenticated using (true);
create policy "Supplier edits own profile" on public.supplier_profiles for update to authenticated
  using (company_id = public.my_company_id()) with check (company_id = public.my_company_id());
create policy "Supplier manages own categories" on public.supplier_categories for insert to authenticated
  with check (supplier_id = public.my_company_id());
create policy "Supplier removes own categories" on public.supplier_categories for delete to authenticated
  using (supplier_id = public.my_company_id());
create policy "Supplier manages own pools" on public.group_buy_pools for insert to authenticated
  with check (supplier_company_id = public.my_company_id());
create policy "Supplier updates own pools" on public.group_buy_pools for update to authenticated
  using (supplier_company_id = public.my_company_id()) with check (supplier_company_id = public.my_company_id());
create policy "Supplier deletes own pools" on public.group_buy_pools for delete to authenticated
  using (supplier_company_id = public.my_company_id());

create policy "Buyer manages projects" on public.projects for all to authenticated
  using (buyer_company_id = public.my_company_id()) with check (buyer_company_id = public.my_company_id());
create policy "Buyer manages RFQs" on public.rfqs for all to authenticated
  using (buyer_company_id = public.my_company_id()) with check (buyer_company_id = public.my_company_id());
create policy "Supplier reads invited RFQs" on public.rfqs for select to authenticated using (public.is_rfq_supplier(id));
create policy "Buyer manages items" on public.rfq_items for all to authenticated
  using (public.is_rfq_buyer(rfq_id)) with check (public.is_rfq_buyer(rfq_id));
create policy "Supplier reads invited items" on public.rfq_items for select to authenticated using (public.is_rfq_supplier(rfq_id));
create policy "Buyer reads recipients" on public.rfq_recipients for select to authenticated using (public.is_rfq_buyer(rfq_id));
create policy "Buyer updates recipients" on public.rfq_recipients for update to authenticated using (public.is_rfq_buyer(rfq_id));
create policy "Supplier reads own invites" on public.rfq_recipients for select to authenticated using (supplier_company_id = public.my_company_id());
create policy "Supplier updates own invites" on public.rfq_recipients for update to authenticated
  using (supplier_company_id = public.my_company_id()) with check (supplier_company_id = public.my_company_id());

create policy "Buyer reads quotes" on public.quotes for select to authenticated using (public.is_rfq_buyer(rfq_id));
create policy "Buyer updates quotes" on public.quotes for update to authenticated using (public.is_rfq_buyer(rfq_id));
create policy "Supplier reads own quotes" on public.quotes for select to authenticated using (supplier_company_id = public.my_company_id());
create policy "Supplier creates own quotes" on public.quotes for insert to authenticated
  with check (supplier_company_id = public.my_company_id() and public.is_rfq_supplier(rfq_id));
create policy "Supplier updates own quotes" on public.quotes for update to authenticated
  using (supplier_company_id = public.my_company_id()) with check (supplier_company_id = public.my_company_id());
create policy "Buyer reads versions" on public.quote_versions for select to authenticated using (public.is_rfq_buyer(public.quote_rfq(quote_id)));
create policy "Buyer counter-offers" on public.quote_versions for insert to authenticated
  with check (party = 'buyer' and public.is_rfq_buyer(public.quote_rfq(quote_id)));
create policy "Supplier reads own versions" on public.quote_versions for select to authenticated
  using (public.quote_supplier(quote_id) = public.my_company_id());
create policy "Supplier offers" on public.quote_versions for insert to authenticated
  with check (party = 'supplier' and public.quote_supplier(quote_id) = public.my_company_id());
create policy "Buyer reads messages" on public.messages for select to authenticated using (public.is_rfq_buyer(rfq_id));
create policy "Buyer sends messages" on public.messages for insert to authenticated
  with check (sender_party = 'buyer' and sender_profile_id = auth.uid() and public.is_rfq_buyer(rfq_id));
create policy "Supplier reads own messages" on public.messages for select to authenticated
  using (public.recipient_supplier(recipient_id) = public.my_company_id());
create policy "Supplier sends messages" on public.messages for insert to authenticated
  with check (sender_party = 'supplier' and sender_profile_id = auth.uid() and public.recipient_supplier(recipient_id) = public.my_company_id());

create policy "Parties read agreements" on public.agreements for select to authenticated
  using (public.is_rfq_buyer(rfq_id) or public.quote_supplier(quote_id) = public.my_company_id());
create policy "Parties read orders" on public.orders for select to authenticated
  using (public.my_company_id() in (buyer_company_id, supplier_company_id));
create policy "Parties read payments" on public.payments for select to authenticated using (public.is_order_party(order_id));
create policy "Buyer reads financing" on public.financing_requests for select to authenticated using (buyer_company_id = public.my_company_id());
create policy "Parties read events" on public.order_events for select to authenticated using (public.is_order_party(order_id));
create policy "Parties read milestones" on public.production_milestones for select to authenticated using (public.is_order_party(order_id));
create policy "Parties read disputes" on public.disputes for select to authenticated using (public.is_order_party(order_id));
create policy "Buyer opens disputes" on public.disputes for insert to authenticated
  with check (opened_by = auth.uid() and exists (select 1 from public.orders o where o.id = order_id and o.buyer_company_id = public.my_company_id()));
create policy "Buyer reviews completed order" on public.reviews for insert to authenticated
  with check (reviewer_company_id = public.my_company_id() and exists (select 1 from public.orders o
    where o.id = order_id and o.buyer_company_id = public.my_company_id() and o.supplier_company_id = reviews.supplier_company_id and o.status = 'completed'));

create policy "Buyer manages own memberships" on public.pool_members for all to authenticated
  using (buyer_company_id = public.my_company_id()) with check (buyer_company_id = public.my_company_id());
create policy "Pool owner reads members" on public.pool_members for select to authenticated using (public.pool_owner(pool_id) = public.my_company_id());

create policy "Read own notifications" on public.notifications for select to authenticated
  using (profile_id = auth.uid() or (profile_id is null and company_id = public.my_company_id()));
create policy "Mark own notifications read" on public.notifications for update to authenticated
  using (profile_id = auth.uid() or (profile_id is null and company_id = public.my_company_id()));

do $$ declare t text; begin
  foreach t in array array['company_public_data','categories','supplier_profiles','supplier_categories','trust_scores','kits',
    'buyer_reliability','projects','rfqs','rfq_items','rfq_recipients','quotes','quote_versions','messages','agreements','orders',
    'pool_members','group_buy_pools','payments','financing_requests','order_events','production_milestones','disputes','reviews',
    'notifications','audit_log'] loop
    execute format('create policy "Admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
grant insert, update, delete on public.company_public_data, public.categories, public.trust_scores, public.kits,
  public.buyer_reliability, public.agreements, public.orders, public.payments, public.financing_requests, public.order_events,
  public.production_milestones, public.notifications, public.audit_log to authenticated;
grant update, delete on public.disputes, public.reviews, public.quote_versions, public.messages to authenticated;
grant delete on public.quotes, public.rfq_recipients to authenticated;
grant insert, update, delete on public.supplier_profiles to authenticated;

create trigger rfqs_updated_at before update on public.rfqs for each row execute function public.update_updated_at();
create trigger quotes_updated_at before update on public.quotes for each row execute function public.update_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.update_updated_at();
create trigger supplier_profiles_updated_at before update on public.supplier_profiles for each row execute function public.update_updated_at();

create view public.price_index as
select ri.category_id, r.delivery_city as region, date_trunc('month', qv.created_at)::date as month,
  round(avg((l->>'unit_price')::numeric), 2) as avg_unit_price,
  min((l->>'unit_price')::numeric) as min, max((l->>'unit_price')::numeric) as max, count(*)::int as sample_count
from public.quotes q
join public.quote_versions qv on qv.quote_id = q.id and qv.version = q.current_version
join public.rfqs r on r.id = q.rfq_id
cross join lateral jsonb_array_elements(qv.lines) l
join public.rfq_items ri on ri.id = (l->>'rfq_item_id')::uuid
where q.status = 'accepted'
group by 1, 2, 3
having count(*) >= 5;
grant select on public.price_index to authenticated, service_role;