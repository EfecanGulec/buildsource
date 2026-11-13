-- lovable-cron-fallback-reviewed: reuses the existing 5-minute scheduler job; adds no new runs
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read settings" ON public.platform_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
INSERT INTO public.platform_settings(key, value) VALUES ('payment_deadline_minutes', '60'::jsonb) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.payment_deadline_minutes() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (value)::text::int FROM platform_settings WHERE key = 'payment_deadline_minutes'), 60)
$$;

CREATE OR REPLACE FUNCTION public.admin_set_payment_deadline(_minutes int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _minutes IS NULL OR _minutes < 5 OR _minutes > 10080 THEN RAISE EXCEPTION 'Deadline must be between 5 minutes and 7 days'; END IF;
  INSERT INTO platform_settings(key, value, updated_at) VALUES ('payment_deadline_minutes', to_jsonb(_minutes), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_payment_deadline(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_deadline(int) TO authenticated;

ALTER TABLE public.orders ADD COLUMN payment_due_at timestamptz;
GRANT SELECT (payment_due_at) ON public.orders TO authenticated;

CREATE OR REPLACE FUNCTION public.orders_payment_deadline() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF new.status = 'awaiting_payment' AND new.payment_due_at IS NULL THEN
      new.payment_due_at := now() + make_interval(mins => payment_deadline_minutes());
    END IF;
  ELSIF old.status = 'awaiting_payment' AND new.status NOT IN ('awaiting_payment','cancelled')
        AND old.payment_due_at IS NOT NULL AND old.payment_due_at < now() THEN
    RAISE EXCEPTION 'The payment deadline has passed, so this order was cancelled';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER orders_payment_deadline BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_payment_deadline();

CREATE OR REPLACE FUNCTION public.expire_unpaid_orders() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM orders WHERE status = 'awaiting_payment' AND payment_due_at < now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = r.id;
    INSERT INTO order_events(order_id, status, note) VALUES (r.id, 'cancelled', 'Cancelled: no payment choice before the deadline');
    PERFORM _notify_order(r.id, true, 'Order cancelled', 'You did not choose Pay now or Pay later before the payment deadline.');
    PERFORM _notify_order(r.id, false, 'Order cancelled', 'The buyer did not pay before the deadline. Your reserved stock and schedule are released.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.expire_unpaid_orders() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._exec_job(_job text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  CASE _job
    WHEN 'pool_close' THEN RETURN jsonb_build_object('pools', process_pools());
    WHEN 'rfq_timeouts' THEN RETURN to_jsonb(process_rfq_timeouts());
    WHEN 'quote_expiry' THEN RETURN jsonb_build_object('expired', expire_stale_quotes());
    WHEN 'trust_recompute' THEN RETURN jsonb_build_object('companies', recompute_all_scores());
    WHEN 'tracking_poll' THEN RETURN jsonb_build_object('late_alerts', shipment_late_alerts());
    WHEN 'payment_expiry' THEN RETURN jsonb_build_object('cancelled', expire_unpaid_orders());
    ELSE RAISE EXCEPTION 'Job % has no runner yet', _job;
  END CASE;
END $$;
REVOKE EXECUTE ON FUNCTION public._exec_job(text) FROM public, anon, authenticated;

SELECT cron.schedule('bs-every-5-min', '*/5 * * * *', $c$select public.scheduler_tick(array['pool_close','rfq_timeouts','quote_expiry','payment_expiry'])$c$);