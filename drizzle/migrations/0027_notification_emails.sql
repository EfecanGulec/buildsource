alter table public.notifications
  add column if not exists email_status text,
  add column if not exists emailed_at timestamptz,
  add column if not exists email_error text;
create index if not exists notifications_email_pending on public.notifications (created_at) where email_status is null;
alter table public.companies add column if not exists contact_email text;
-- Old notifications are never emailed retroactively.
update public.notifications set email_status = 'skipped_old' where email_status is null;