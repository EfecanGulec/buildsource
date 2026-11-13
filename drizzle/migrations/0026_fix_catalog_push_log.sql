create or replace function public.orders_catalog_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select * into f from product_feeds where supplier_company_id = new.supplier_company_id
    and type in ('woocommerce','shopify','prestashop','erp') and last_status in ('ok','partial') limit 1;
  if found then
    insert into integration_logs(service, provider, action, request_summary, response_status)
    values ('catalog', f.type, 'push_order', jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'mode', 'demo',
            'external_order_id', upper(f.type) || '-' || substr(new.id::text,1,8)), 200);
  end if;
  return new;
exception when others then
  return new; -- push-back must never block order creation
end $$;