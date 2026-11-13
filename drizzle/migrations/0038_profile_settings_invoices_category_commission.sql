ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_delivery jsonb;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS commission_rate numeric;
ALTER TABLE public.categories ADD CONSTRAINT categories_commission_rate_range CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 0.3));

CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select jsonb_build_object('full_name', p.full_name, 'phone', p.phone, 'email', coalesce(p.email, u.email),
    'language', p.language, 'default_delivery', p.default_delivery,
    'company', (select jsonb_build_object('name', c.name, 'company_code', c.company_code, 'vat_code', c.vat_code, 'city', c.city,
       'country', c.country, 'address', c.address, 'buyer_segment', c.buyer_segment, 'type', c.type) from companies c where c.id = p.company_id))
  from profiles p left join auth.users u on u.id = p.id where p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.save_my_profile(_full_name text, _phone text, _language text, _address text, _vat_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _cid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(coalesce(_full_name,'')) > 200 or length(coalesce(_phone,'')) > 80 or length(coalesce(_address,'')) > 500 or length(coalesce(_vat_code,'')) > 40 then
    raise exception 'Value too long'; end if;
  update profiles set full_name = nullif(trim(_full_name),''), phone = nullif(trim(_phone),''),
    language = case when _language in ('en','lt') then _language else language end, updated_at = now()
  where id = auth.uid() returning company_id into _cid;
  if _cid is not null then
    update companies set address = nullif(trim(_address),''), vat_code = nullif(trim(_vat_code),''), updated_at = now() where id = _cid;
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.save_my_default_delivery(_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _details is not null and (jsonb_typeof(_details) <> 'object' or length(_details::text) > 5000) then raise exception 'Invalid delivery details'; end if;
  update profiles set default_delivery = _details, updated_at = now() where id = auth.uid();
end $$;

-- Effective rate for a category: own rate, else parent's rate, else null (standard tiers)
CREATE OR REPLACE FUNCTION public.category_commission_rate(_category uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(c.commission_rate, p.commission_rate) from categories c left join categories p on p.id = c.parent_id where c.id = _category
$$;

CREATE OR REPLACE FUNCTION public.calc_commission(_version uuid, _buyer uuid, _supplier uuid)
RETURNS TABLE(rate numeric, amount numeric) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
declare _mat numeric := 0; _fur numeric := 0; _fixed numeric := 0; _fixed_amt numeric := 0; _total numeric; _repeat boolean; _pro boolean; _mrate numeric; _amt numeric;
begin
  select coalesce(sum((l->>'line_total')::numeric) filter (where r.cr is null and coalesce(c.commission_group,'materials') = 'materials'),0),
         coalesce(sum((l->>'line_total')::numeric) filter (where r.cr is null and c.commission_group = 'furniture_equipment'),0),
         coalesce(sum((l->>'line_total')::numeric) filter (where r.cr is not null),0),
         coalesce(sum((l->>'line_total')::numeric * r.cr) filter (where r.cr is not null),0)
    into _mat, _fur, _fixed, _fixed_amt
  from quote_versions v cross join lateral jsonb_array_elements(v.lines) l
  left join rfq_items i on i.id = (l->>'rfq_item_id')::uuid left join categories c on c.id = i.category_id
  cross join lateral (select public.category_commission_rate(c.id) cr) r
  where v.id = _version;
  _total := _mat + _fur + _fixed;
  if _total <= 0 then rate := 0; amount := 0; return next; return; end if;
  _repeat := exists (select 1 from orders where buyer_company_id = _buyer and supplier_company_id = _supplier and status = 'completed');
  _pro := coalesce((select pro_subscription from supplier_profiles where company_id = _supplier), false);
  if _repeat then
    _amt := (_mat + _fur) * 0.01;
  else
    _mrate := case when _mat <= 5000 then 0.03 when _mat <= 50000 then 0.02 else 0.01 end;
    if _pro then _mrate := greatest(_mrate - 0.005, 0.01); end if;
    _amt := least(_mat * _mrate, 2000) + _fur * (case when _pro then 0.035 else 0.04 end);
  end if;
  _amt := _amt + _fixed_amt;
  amount := round(_amt, 2); rate := round(_amt / _total, 4); return next;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_category_commission(_category uuid, _rate numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if _rate is not null and (_rate < 0 or _rate > 0.3) then raise exception 'Rate must be between 0%% and 30%%'; end if;
  update categories set commission_rate = _rate where id = _category;
  insert into audit_log (entity, entity_id, action, actor_profile_id, data) values ('category', _category, 'set_commission', auth.uid(), jsonb_build_object('rate', _rate));
end $$;

CREATE OR REPLACE FUNCTION public.admin_order_commissions()
RETURNS TABLE(order_id uuid, order_number text, buyer_name text, supplier_name text, categories text, status order_status, total numeric, commission_rate numeric, commission_amount numeric, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select o.id, o.order_number, b.name, s.name,
    coalesce((select string_agg(distinct c.name_en, ', ') from rfq_items i join categories c on c.id = i.category_id where i.rfq_id = o.rfq_id),
             (select c.name_en from group_buy_pools p join categories c on c.id = p.category_id where p.id = o.pool_id)),
    o.status, o.total, o.commission_rate, o.commission_amount, o.created_at
  from orders o join companies b on b.id = o.buyer_company_id join companies s on s.id = o.supplier_company_id
  order by o.created_at desc limit 500;
end $$;

CREATE OR REPLACE FUNCTION public.my_invoices()
RETURNS TABLE(order_id uuid, order_number text, side text, counterparty text, title text, status order_status, total numeric, commission_amount numeric, supplier_payout numeric, payment_method payment_method, paid boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select o.id, o.order_number,
    case when o.buyer_company_id = public.my_company_id() then 'buyer' else 'supplier' end,
    case when o.buyer_company_id = public.my_company_id() then s.name else b.name end,
    coalesce(r.title, p.product_name), o.status, o.total,
    case when o.supplier_company_id = public.my_company_id() then o.commission_amount end,
    case when o.supplier_company_id = public.my_company_id() then o.supplier_payout end,
    o.payment_method,
    o.status not in ('awaiting_payment','cancelled'),
    o.created_at
  from orders o join companies b on b.id = o.buyer_company_id join companies s on s.id = o.supplier_company_id
  left join rfqs r on r.id = o.rfq_id left join group_buy_pools p on p.id = o.pool_id
  where public.my_company_id() in (o.buyer_company_id, o.supplier_company_id) and o.status <> 'cancelled'
  order by o.created_at desc
$$;

CREATE OR REPLACE FUNCTION public.invoice_detail(_order uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare _me uuid := public.my_company_id(); o orders; _sup boolean; _lines jsonb; _sub numeric; _del numeric;
begin
  select * into o from orders where id = _order;
  if o.id is null or not (_me in (o.buyer_company_id, o.supplier_company_id) or public.is_admin()) then raise exception 'Not your order'; end if;
  _sup := _me = o.supplier_company_id or public.is_admin();
  select jsonb_agg(jsonb_build_object('name', i.description, 'unit', i.unit, 'quantity', (l->>'quantity')::numeric,
           'unit_price', (l->>'unit_price')::numeric, 'line_total', (l->>'line_total')::numeric) order by i.sort_order), v.subtotal, v.delivery_cost
    into _lines, _sub, _del
  from agreements a join quote_versions v on v.id = a.quote_version_id
  cross join lateral jsonb_array_elements(v.lines) l join rfq_items i on i.id = (l->>'rfq_item_id')::uuid
  where a.id = o.agreement_id group by v.subtotal, v.delivery_cost;
  if _lines is null and o.pool_id is not null then
    select jsonb_build_array(jsonb_build_object('name', p.product_name, 'unit', p.unit, 'quantity', m.quantity,
      'unit_price', coalesce(p.final_unit_price, p.base_price), 'line_total', o.total)), o.total, 0
      into _lines, _sub, _del
    from group_buy_pools p join pool_members m on m.order_id = o.id where p.id = o.pool_id limit 1;
  end if;
  return jsonb_build_object('order_number', o.order_number, 'created_at', o.created_at, 'status', o.status, 'payment_method', o.payment_method,
    'buyer', (select jsonb_build_object('name', name, 'company_code', company_code, 'vat_code', vat_code, 'address', address, 'city', city, 'country', country) from companies where id = o.buyer_company_id),
    'supplier', (select jsonb_build_object('name', name, 'company_code', company_code, 'vat_code', vat_code, 'address', address, 'city', city, 'country', country) from companies where id = o.supplier_company_id),
    'lines', coalesce(_lines, '[]'::jsonb), 'subtotal', coalesce(_sub, o.total), 'delivery_cost', coalesce(_del, 0), 'total', o.total,
    'commission_rate', case when _sup then o.commission_rate end, 'commission_amount', case when _sup then o.commission_amount end,
    'supplier_payout', case when _sup then o.supplier_payout end);
end $$;

REVOKE ALL ON FUNCTION public.my_profile(), public.save_my_profile(text,text,text,text,text), public.save_my_default_delivery(jsonb),
  public.admin_set_category_commission(uuid,numeric), public.admin_order_commissions(), public.my_invoices(), public.invoice_detail(uuid),
  public.category_commission_rate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile(), public.save_my_profile(text,text,text,text,text), public.save_my_default_delivery(jsonb),
  public.admin_set_category_commission(uuid,numeric), public.admin_order_commissions(), public.my_invoices(), public.invoice_detail(uuid),
  public.category_commission_rate(uuid) TO authenticated;
GRANT SELECT (commission_rate) ON public.categories TO authenticated;