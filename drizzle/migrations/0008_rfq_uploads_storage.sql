create policy "rfq uploads: company insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'rfq-uploads' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "rfq uploads: company read" on storage.objects for select to authenticated
  using (bucket_id = 'rfq-uploads' and ((storage.foldername(name))[1] = public.my_company_id()::text or public.is_admin()));
create policy "rfq uploads: company delete" on storage.objects for delete to authenticated
  using (bucket_id = 'rfq-uploads' and (storage.foldername(name))[1] = public.my_company_id()::text);