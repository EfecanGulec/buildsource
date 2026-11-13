DROP POLICY IF EXISTS "Read" ON public.group_buy_pools;
CREATE POLICY "Read" ON public.group_buy_pools FOR SELECT TO authenticated USING (
  supplier_company_id = public.my_company_id()
  OR (status = 'open' AND public.has_role(auth.uid(), 'buyer'))
  OR EXISTS (SELECT 1 FROM public.pool_members m WHERE m.pool_id = group_buy_pools.id AND m.buyer_company_id = public.my_company_id())
);

DROP POLICY IF EXISTS "Read" ON public.reviews;
CREATE POLICY "Read" ON public.reviews FOR SELECT TO authenticated USING (
  reviewer_company_id = public.my_company_id()
  OR supplier_company_id = public.my_company_id()
  OR public.has_role(auth.uid(), 'buyer')
);

DROP POLICY IF EXISTS "Read" ON public.trust_scores;
CREATE POLICY "Read" ON public.trust_scores FOR SELECT TO authenticated USING (
  company_id = public.my_company_id()
  OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = trust_scores.company_id AND c.type = 'supplier')
);

DROP POLICY IF EXISTS "Read" ON public.buyer_reliability;
CREATE POLICY "Read" ON public.buyer_reliability FOR SELECT TO authenticated USING (
  company_id = public.my_company_id()
  OR EXISTS (SELECT 1 FROM public.rfqs r JOIN public.rfq_recipients rr ON rr.rfq_id = r.id
             WHERE r.buyer_company_id = buyer_reliability.company_id AND rr.supplier_company_id = public.my_company_id())
  OR EXISTS (SELECT 1 FROM public.orders o
             WHERE o.buyer_company_id = buyer_reliability.company_id AND o.supplier_company_id = public.my_company_id())
);