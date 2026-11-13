CREATE OR REPLACE FUNCTION public.match_rfq(_rfq uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _max int; _n int := 0; c record; _buyer uuid; _pref uuid[];
begin
  select max_suppliers, buyer_company_id, coalesce(preferred_supplier_ids,'{}') into _max, _buyer, _pref from rfqs where id = _rfq;
  -- When the buyer picked suppliers, invite only those (falls back to normal ranking if none qualify).
  if cardinality(_pref) > 0 then
    for c in select k.* from rank_rfq_candidates(_rfq) k where k.supplier_company_id = any(_pref)
             order by k.match_score desc, k.supplier_company_id loop
      _n := _n + 1;
      perform _invite_supplier(_rfq, c.supplier_company_id, c.match_score, _n, c.is_claimed);
    end loop;
  end if;
  if _n = 0 then
    for c in select k.* from rank_rfq_candidates(_rfq) k
             order by k.match_score desc, k.supplier_company_id limit coalesce(_max,5) loop
      _n := _n + 1;
      perform _invite_supplier(_rfq, c.supplier_company_id, c.match_score, _n, c.is_claimed);
    end loop;
  end if;
  update rfqs set status = 'matched' where id = _rfq and status = 'submitted' and _n > 0;
  insert into notifications(company_id, type, title, body, link)
  select _buyer, 'matched', rfq_number || ' sent to ' || _n || ' suppliers', title, '/app/rfqs/' || id from rfqs where id = _rfq;
  return _n;
end $function$;