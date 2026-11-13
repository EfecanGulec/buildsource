alter function public.reset_demo_data() rename to seed_demo_scored;
revoke execute on function public.seed_demo_scored() from public, anon, authenticated;

-- Demo script (spec §11): the café joins the bistro-chair pool live, so it starts outside the pool
-- and its 40 chairs move the bar to "40 more → −8%".
create or replace function public.reset_demo_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;
  res := public.seed_demo_scored();
  delete from pool_members m using companies c
   where c.id = m.buyer_company_id and c.is_demo and c.company_code = '300000003';
  return res;
end $$;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.reset_demo_data() to service_role;