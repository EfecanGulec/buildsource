ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS delivery_date_rejection text;

-- Agreements signed by the supplier before a date was required: reopen the supplier's signature.
UPDATE public.agreements SET supplier_signed_at = NULL, supplier_signature_code = NULL
 WHERE status = 'pending' AND buyer_signed_at IS NULL AND supplier_signed_at IS NOT NULL AND delivery_date IS NULL;

CREATE OR REPLACE FUNCTION public.buyer_sign_agreement(_agreement uuid, _code text, _latest date, _note text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a agreements;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR NOT public.is_rfq_buyer(a.rfq_id) THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF a.status <> 'pending' OR a.buyer_signed_at IS NOT NULL THEN RAISE EXCEPTION 'Agreement is not open for signing'; END IF;
 IF a.supplier_signed_at IS NULL OR a.delivery_date IS NULL THEN RAISE EXCEPTION 'Wait for the supplier to sign with a delivery date first'; END IF;
 IF _latest IS NOT NULL AND _latest < current_date THEN RAISE EXCEPTION 'Latest date cannot be in the past'; END IF;
 UPDATE agreements SET buyer_latest_date=_latest, buyer_delivery_note=nullif(left(btrim(coalesce(_note,'')),1000),''), delivery_date_rejection=NULL WHERE id=a.id;
 RETURN public.sign_agreement(_agreement,_code);
END $function$;

CREATE OR REPLACE FUNCTION public.buyer_reject_delivery_date(_agreement uuid, _reason text, _latest date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a agreements; sup uuid; r text;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR NOT public.is_rfq_buyer(a.rfq_id) THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF a.status <> 'pending' OR a.buyer_signed_at IS NOT NULL OR a.supplier_signed_at IS NULL THEN RAISE EXCEPTION 'There is no delivery date to refuse'; END IF;
 IF _latest IS NOT NULL AND _latest < current_date THEN RAISE EXCEPTION 'Latest date cannot be in the past'; END IF;
 r := nullif(left(btrim(coalesce(_reason,'')),1000),'');
 IF r IS NULL THEN RAISE EXCEPTION 'Tell the supplier why the date does not work'; END IF;
 UPDATE agreements SET supplier_signed_at=NULL, supplier_signature_code=NULL, delivery_date=NULL, delivery_time_window=NULL,
   delivery_date_rejection=r, buyer_latest_date=_latest WHERE id=a.id;
 SELECT supplier_company_id INTO sup FROM quotes WHERE id=a.quote_id;
 INSERT INTO notifications(company_id,type,title,body,link)
 VALUES (sup,'agreement','Delivery date refused','The buyer asked for a different delivery date: '||r,'/supplier/agreements/'||a.id);
END $function$;
REVOKE ALL ON FUNCTION public.buyer_reject_delivery_date(uuid,text,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.buyer_reject_delivery_date(uuid,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.supplier_sign_agreement(_agreement uuid, _code text, _date date, _time text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a agreements; qu quotes;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR a.status <> 'pending' OR a.supplier_signed_at IS NOT NULL THEN RAISE EXCEPTION 'Agreement is not open for signing'; END IF;
 SELECT * INTO qu FROM quotes WHERE id=a.quote_id;
 IF qu.supplier_company_id IS DISTINCT FROM public.my_company_id() THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF _date IS NULL OR _date < current_date THEN RAISE EXCEPTION 'Enter an estimated delivery date that is not in the past'; END IF;
 UPDATE agreements SET delivery_date=_date, delivery_time_window=nullif(left(btrim(coalesce(_time,'')),100),'') WHERE id=a.id;
 UPDATE rfqs SET delivery_date_requested=_date, delivery_week=to_char(_date,'IYYY-"W"IW') WHERE id=a.rfq_id;
 INSERT INTO notifications(company_id,type,title,body,link)
 SELECT r.buyer_company_id,'agreement','Supplier set a delivery date','Estimated delivery: '||_date::text||'. Review and sign.','/app/agreements/'||a.id FROM rfqs r WHERE r.id=a.rfq_id;
 RETURN public.sign_agreement(_agreement,_code);
END $function$;