create or replace function public.rfq_scan_photos(_rfq uuid) returns text[] language sql stable security definer set search_path = public
as $$ select coalesce(s.photo_paths, '{}') from public.rfqs r join public.material_scans s on s.id = r.material_scan_id
  where r.id = _rfq and (public.is_rfq_buyer(_rfq) or public.is_rfq_supplier(_rfq) or public.is_admin()) $$;
grant execute on function public.rfq_scan_photos(uuid) to authenticated;
create or replace function public.can_read_scan_photo(_path text) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.material_scans s join public.rfqs r on r.material_scan_id = s.id
  where _path = any(s.photo_paths) and public.is_rfq_supplier(r.id)) $$;
grant execute on function public.can_read_scan_photo(text) to authenticated;
create policy "material scans: invited supplier read" on storage.objects for select to authenticated
  using (bucket_id = 'material-scans' and public.can_read_scan_photo(name));