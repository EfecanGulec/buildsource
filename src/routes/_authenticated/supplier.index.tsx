import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stat, StatSkeleton } from "@/components/dashboard/stat";
import { TrustBadge, type Breakdown } from "@/components/trust-badge";
import { eur } from "@/components/rfq/quote-thread";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";

type Dash = { new_rfqs: number; threads_waiting: number; orders_to_fulfil: number; won_this_month: number; response_rate: number | null };
type Comp = { key: string; points: number; max: number };

export const Route = createFileRoute("/_authenticated/supplier/")({
  head: () => ({ meta: [{ title: "Supplier dashboard — BuildSource LT" }] }),
  component: SupplierDashboard,
});

function SupplierDashboard() {
  const { t } = useI18n();
  const account = useAccount();
  const companyId = account.data?.company?.id;
  const q = useQuery({ queryKey: ["supplier-dashboard", companyId], enabled: !!companyId, queryFn: async () => {
    const [{ data, error }, { data: trust }] = await Promise.all([
      supabase.rpc("supplier_dashboard"),
      supabase.from("trust_scores").select("score,breakdown").eq("company_id", companyId!).maybeSingle(),
    ]);
    if (error) throw error;
    return { d: data as unknown as Dash, trust };
  } });
  const d = q.data?.d;
  const trust = q.data?.trust;
  const comps = ((trust?.breakdown as Breakdown | null)?.components ?? []) as Comp[];
  return (
    <div className="max-w-5xl space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{account.data?.company?.name}</p>
        <h1 className="font-display text-2xl font-semibold">{t("nav.dashboard")}</h1></div>
      {!d ? <StatSkeleton /> : (<>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label={t("dash.newRfqs")} value={d.new_rfqs} to="/supplier/inbox" />
          <Stat label={t("dash.threadsWaiting")} value={d.threads_waiting} to="/supplier/inbox" />
          <Stat label={t("dash.toFulfil")} value={d.orders_to_fulfil} to="/supplier/orders" />
          <Stat label={t("dash.wonMonth")} value={eur(Number(d.won_this_month))} />
          <Stat label={t("dash.responseRate")} value={d.response_rate == null ? "—" : `${Math.round(Number(d.response_rate) * 100)}%`} />
        </div>
        <section className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-display font-semibold">Trust Score</h2>
            {trust && <TrustBadge score={trust.score} breakdown={trust.breakdown as Breakdown} />}</div>
          {comps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> :
            <ul className="grid gap-2 sm:grid-cols-2">{comps.map((c) => (
              <li key={c.key} className="space-y-1 text-sm">
                <div className="flex justify-between"><span>{t(`trust.c.${c.key}` as TKey)}</span><span className="tabular-nums">{c.points}/{c.max}</span></div>
                <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${c.max ? (c.points / c.max) * 100 : 0}%` }} /></div>
              </li>))}</ul>}
        </section>
      </>)}
    </div>
  );
}
