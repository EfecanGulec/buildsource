ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS delivery_time_window text;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS buyer_latest_date date;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS buyer_delivery_note text;

CREATE OR REPLACE FUNCTION public._save_agreement_delivery(_agreement uuid, _details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a agreements; d jsonb;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR NOT public.is_rfq_buyer(a.rfq_id) THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF a.status <> 'pending' OR a.buyer_signed_at IS NOT NULL OR a.supplier_signed_at IS NOT NULL THEN RAISE EXCEPTION 'Delivery details are locked after signing'; END IF;
 IF jsonb_typeof(_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Delivery details are required'; END IF;
 IF coalesce(btrim(_details->>'city'),'')='' OR coalesce(btrim(_details->>'address'),'')='' OR coalesce(btrim(_details->>'contact'),'')='' OR coalesce(btrim(_details->>'phone'),'')='' THEN RAISE EXCEPTION 'Enter city, address and site contact'; END IF;
 IF coalesce(_details->>'unloading','') NOT IN ('manual','crane_needed','forklift_on_site') OR coalesce(_details->>'window','') NOT IN ('any','morning','afternoon') THEN RAISE EXCEPTION 'Choose unloading and delivery window'; END IF;
 d := jsonb_build_object('city',btrim(_details->>'city'),'address',btrim(_details->>'address'),'contact',btrim(_details->>'contact'),'phone',btrim(_details->>'phone'),'unloading',_details->>'unloading','window',_details->>'window','access',left(coalesce(_details->>'access',''),2000));
 UPDATE agreements SET delivery_details=d WHERE id=a.id;
 UPDATE rfqs SET delivery_city=d->>'city',delivery_address=d->>'address',unloading=d->>'unloading',delivery_window=d->>'window',site_access_notes=nullif(d->>'access','') WHERE id=a.rfq_id;
 INSERT INTO rfq_site_contacts(rfq_id,name,phone) VALUES(a.rfq_id,d->>'contact',d->>'phone') ON CONFLICT(rfq_id) DO UPDATE SET name=excluded.name,phone=excluded.phone;
END $$;
REVOKE ALL ON FUNCTION public._save_agreement_delivery(uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Order of signing: buyer address -> supplier signs with estimated date -> buyer confirms and signs.
CREATE OR REPLACE FUNCTION public.agreement_signing_order() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.supplier_signed_at IS NOT NULL AND OLD.supplier_signed_at IS NULL AND NEW.delivery_date IS NULL THEN RAISE EXCEPTION 'The supplier must set an estimated delivery date when signing'; END IF;
 IF NEW.buyer_signed_at IS NOT NULL AND OLD.buyer_signed_at IS NULL AND NEW.supplier_signed_at IS NULL THEN RAISE EXCEPTION 'Wait for the supplier to sign with a delivery date first'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agreement_signing_order ON public.agreements;
CREATE TRIGGER agreement_signing_order BEFORE UPDATE OF buyer_signed_at,supplier_signed_at ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.agreement_signing_order();

CREATE OR REPLACE FUNCTION public.supplier_sign_agreement(_agreement uuid,_code text,_date date,_time text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a agreements; qu quotes;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR a.status <> 'pending' OR a.supplier_signed_at IS NOT NULL THEN RAISE EXCEPTION 'Agreement is not open for signing'; END IF;
 SELECT * INTO qu FROM quotes WHERE id=a.quote_id;
 IF qu.supplier_company_id IS DISTINCT FROM public.my_company_id() THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF _date IS NULL OR _date < current_date THEN RAISE EXCEPTION 'Enter an estimated delivery date that is not in the past'; END IF;
 UPDATE agreements SET delivery_date=_date, delivery_time_window=nullif(left(btrim(coalesce(_time,'')),100),'') WHERE id=a.id;
 UPDATE rfqs SET delivery_date_requested=_date, delivery_week=to_char(_date,'IYYY-"W"IW') WHERE id=a.rfq_id;
 RETURN public.sign_agreement(_agreement,_code);
END $$;
REVOKE ALL ON FUNCTION public.supplier_sign_agreement(uuid,text,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.supplier_sign_agreement(uuid,text,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.buyer_sign_agreement(_agreement uuid,_code text,_latest date,_note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a agreements;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR NOT public.is_rfq_buyer(a.rfq_id) THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF a.status <> 'pending' OR a.buyer_signed_at IS NOT NULL THEN RAISE EXCEPTION 'Agreement is not open for signing'; END IF;
 IF _latest IS NOT NULL AND _latest < current_date THEN RAISE EXCEPTION 'Latest date cannot be in the past'; END IF;
 UPDATE agreements SET buyer_latest_date=_latest, buyer_delivery_note=nullif(left(btrim(coalesce(_note,'')),1000),'') WHERE id=a.id;
 RETURN public.sign_agreement(_agreement,_code);
END $$;
REVOKE ALL ON FUNCTION public.buyer_sign_agreement(uuid,text,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buyer_sign_agreement(uuid,text,date,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sign_agreement(uuid,text) FROM PUBLIC, anon, authenticated;