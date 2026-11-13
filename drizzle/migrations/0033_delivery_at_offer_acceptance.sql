ALTER TABLE public.agreements ADD COLUMN delivery_details jsonb;
ALTER TABLE public.agreements ADD COLUMN delivery_details_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.agreements ALTER COLUMN delivery_details_required SET DEFAULT true;
CREATE OR REPLACE FUNCTION public._save_agreement_delivery(_agreement uuid, _details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a agreements; d jsonb; requested date;
BEGIN
 SELECT * INTO a FROM agreements WHERE id=_agreement FOR UPDATE;
 IF a.id IS NULL OR NOT public.is_rfq_buyer(a.rfq_id) THEN RAISE EXCEPTION 'Not your agreement'; END IF;
 IF a.status <> 'pending' OR a.buyer_signed_at IS NOT NULL OR a.supplier_signed_at IS NOT NULL THEN RAISE EXCEPTION 'Delivery details are locked after signing'; END IF;
 IF jsonb_typeof(_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Delivery details are required'; END IF;
 IF coalesce(btrim(_details->>'city'),'')='' OR coalesce(btrim(_details->>'address'),'')='' OR coalesce(btrim(_details->>'date'),'')='' OR coalesce(btrim(_details->>'contact'),'')='' OR coalesce(btrim(_details->>'phone'),'')='' THEN RAISE EXCEPTION 'Enter city, address, delivery date and site contact'; END IF;
 requested := (_details->>'date')::date;
 IF requested < current_date THEN RAISE EXCEPTION 'Delivery date cannot be in the past'; END IF;
 IF coalesce(_details->>'unloading','') NOT IN ('manual','crane_needed','forklift_on_site') OR coalesce(_details->>'window','') NOT IN ('any','morning','afternoon') THEN RAISE EXCEPTION 'Choose unloading and delivery window'; END IF;
 d := jsonb_build_object('city',btrim(_details->>'city'),'address',btrim(_details->>'address'),'date',requested::text,'contact',btrim(_details->>'contact'),'phone',btrim(_details->>'phone'),'unloading',_details->>'unloading','window',_details->>'window','access',left(coalesce(_details->>'access',''),2000));
 UPDATE agreements SET delivery_details=d WHERE id=a.id;
 UPDATE rfqs SET delivery_city=d->>'city',delivery_address=d->>'address',delivery_date_requested=requested,delivery_week=to_char(requested,'IYYY-"W"IW'),unloading=d->>'unloading',delivery_window=d->>'window',site_access_notes=nullif(d->>'access','') WHERE id=a.rfq_id;
 INSERT INTO rfq_site_contacts(rfq_id,name,phone) VALUES(a.rfq_id,d->>'contact',d->>'phone') ON CONFLICT(rfq_id) DO UPDATE SET name=excluded.name,phone=excluded.phone;
END $$;
REVOKE ALL ON FUNCTION public._save_agreement_delivery(uuid,jsonb) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.buyer_accept_quote_with_delivery(_quote uuid,_details jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE agreement_id uuid; rfq_id uuid;
BEGIN
 SELECT q.rfq_id INTO rfq_id FROM quotes q WHERE q.id=_quote;
 IF rfq_id IS NULL OR NOT public.is_rfq_buyer(rfq_id) THEN RAISE EXCEPTION 'Not your RFQ'; END IF;
 PERFORM 1 FROM rfqs WHERE id=rfq_id FOR UPDATE;
 agreement_id := public.buyer_accept_quote(_quote);
 PERFORM public._save_agreement_delivery(agreement_id,_details);
 RETURN agreement_id;
END $$;
REVOKE ALL ON FUNCTION public.buyer_accept_quote_with_delivery(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buyer_accept_quote_with_delivery(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.buyer_save_agreement_delivery(_agreement uuid,_details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public._save_agreement_delivery(_agreement,_details); END $$;
REVOKE ALL ON FUNCTION public.buyer_save_agreement_delivery(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buyer_save_agreement_delivery(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.agreement_require_delivery() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.delivery_details_required AND NEW.delivery_details IS NULL AND (NEW.buyer_signed_at IS NOT NULL OR NEW.supplier_signed_at IS NOT NULL) THEN RAISE EXCEPTION 'The buyer must add delivery details before signing'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER agreement_delivery_before_sign BEFORE UPDATE OF buyer_signed_at,supplier_signed_at ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.agreement_require_delivery();