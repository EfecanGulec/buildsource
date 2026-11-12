alter function public.reset_demo_data() rename to seed_demo_base;
revoke execute on function public.seed_demo_base() from public, anon, authenticated;

create or replace function public.reset_demo_data() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare res jsonb; r record; ag uuid; ord uuid; i int := 1; tomas uuid; baltic uuid; u_buyer uuid; u_sup uuid; late boolean;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;
  res := public.seed_demo_base();
  select id into tomas from companies where is_demo and company_code = '300000001';
  select id into baltic from companies where is_demo and company_code = '300000101';
  select id into u_buyer from profiles where email = 'buyer@demo.lt';
  select id into u_sup from profiles where email = 'supplier@demo.lt';
  -- Extra completed Baltic Insulation orders so its platform score comes from real history (>= 3 orders)
  for r in select q.rfq_id, q.id quote_id, qv.id qv_id, qv.total, qv.created_at, rf.rfq_number
           from quotes q join quote_versions qv on qv.quote_id = q.id join rfqs rf on rf.id = q.rfq_id
           where rf.rfq_number in ('RFQ-2025-0101','RFQ-2025-0103','RFQ-2025-0104') order by rf.rfq_number loop
    i := i + 1; late := r.rfq_number = 'RFQ-2025-0104';
    insert into agreements (rfq_id,quote_id,quote_version_id,total,lead_time_days,delivery_date,payment_terms,buyer_signed_at,buyer_signature_code,supplier_signed_at,supplier_signature_code,status,created_at)
      values (r.rfq_id,r.quote_id,r.qv_id,r.total,5,(r.created_at + interval '7 days')::date,'Escrow',r.created_at+interval '2 hours','5512',r.created_at+interval '3 hours','7730','signed',r.created_at)
      returning id into ag;
    insert into orders (order_number,agreement_id,rfq_id,buyer_company_id,supplier_company_id,total,commission_rate,commission_amount,supplier_payout,status,created_at)
      values ('ORD-2026-'||lpad(i::text,4,'0'),ag,r.rfq_id,tomas,baltic,r.total,0.03,round(r.total*0.03,2),round(r.total*0.97,2),'completed',r.created_at)
      returning id into ord;
    insert into payments (order_id,amount,status,held_at,released_at) values (ord,r.total,'released',r.created_at,r.created_at+interval '12 days');
    insert into order_events (order_id,status,note,created_by,created_at) values
      (ord,'paid_escrow','Payment held in escrow (demo)',u_buyer,r.created_at),
      (ord,'delivered','Delivered to site',u_sup,r.created_at + case when late then interval '10 days' else interval '5 days' end),
      (ord,'completed','Buyer accepted delivery',u_buyer,r.created_at + interval '11 days');
    insert into reviews (order_id,reviewer_company_id,supplier_company_id,rating,comment,created_at)
      values (ord,tomas,baltic,case when late then 4 else 5 end,case when late then 'Good material, delivery was a few days late.' else 'Smooth delivery, as agreed.' end,r.created_at+interval '12 days');
  end loop;
  -- The seed's agreement had no date; give it one so on-time can be judged (delivered 9 days after order: late)
  update agreements a set delivery_date = (o.created_at + interval '7 days')::date from orders o
    where o.agreement_id = a.id and o.order_number = 'ORD-2026-0001' and a.delivery_date is null;
  perform public.recompute_all_scores();
  return res;
end $$;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.reset_demo_data() to service_role;