DROP POLICY IF EXISTS "Read" ON public.kits;
CREATE POLICY "Read" ON public.kits FOR SELECT TO authenticated USING (public.my_company_id() IS NOT NULL OR public.is_admin());
DROP POLICY IF EXISTS "Read" ON public.categories;
CREATE POLICY "Read" ON public.categories FOR SELECT TO authenticated USING (public.my_company_id() IS NOT NULL OR public.is_admin());
DROP POLICY IF EXISTS "Read" ON public.company_public_data;
CREATE POLICY "Read" ON public.company_public_data FOR SELECT TO authenticated USING (
  public.is_admin() OR company_id = public.my_company_id()
  OR (public.my_company_id() IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.type = 'supplier')));
DROP POLICY IF EXISTS "Read" ON public.supplier_profiles;
CREATE POLICY "Read" ON public.supplier_profiles FOR SELECT TO authenticated USING (
  public.is_admin() OR company_id = public.my_company_id() OR public.my_company_id() IS NOT NULL);
DROP POLICY IF EXISTS "Read" ON public.supplier_categories;
CREATE POLICY "Read" ON public.supplier_categories FOR SELECT TO authenticated USING (
  public.is_admin() OR supplier_id = public.my_company_id() OR public.my_company_id() IS NOT NULL);