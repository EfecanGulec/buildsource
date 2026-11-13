create or replace function public.trg_recompute_from_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform compute_trust_score(new.supplier_company_id);
  perform compute_buyer_reliability(new.buyer_company_id);
  return new;
end $$;