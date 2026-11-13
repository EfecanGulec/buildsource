import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stat, StatSkeleton } from "@/components/dashboard/stat";
import { StatusBadge } from "@/components/rfq/status-badge";
import { PoolStatus } from "@/components/pool/pool-card";
import { eur } from "@/components/rfq/quote-thread";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type Dash = { open_rfqs: number; quotes_waiting: number; savings: number; savings_negotiation: number; savings_pools: number;
  active_orders: { id: string; order_number: string; status: OrderStatus; total: number }[];
  pools: { id: string; product_name: string; status: string; member_status: string; quantity: number; unit: string }[] };

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — BuildSource LT" }] }),
  component: BuyerDashboard,
});

function BuyerDashboard() {
  const { t } = useI18n();
  const account = useAccount();
  const q = useQuery({ queryKey: ["buyer-dashboard"], queryFn: async () => {
    const { data, error } = await supabase.rpc("buyer_dashboard");
    if (error) throw error;
    return data as unknown as Dash;
  } });
  const d = q.data;
  return (
    <div className="max-w-5xl space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{account.data?.company?.name}</p>
        <h1 className="font-display text-2xl font-semibold">{t("nav.dashboard")}</h1></div>
      {!d ? <StatSkeleton /> : (<>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("dash.openRfqs")} value={d.open_rfqs} to="/app/rfqs" />
          <Stat label={t("dash.quotesWaiting")} value={d.quotes_waiting} to="/app/compare" />
          <Stat label={t("dash.activeOrders")} value={d.active_orders.length} to="/app/orders" />
          <Stat label={t("dash.savings")} value={eur(d.savings)}
            hint={`${t("dash.fromNegotiation")} ${eur(d.savings_negotiation)} · ${t("nav.groupBuy")} ${eur(d.savings_pools)}`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="font-display font-semibold">{t("dash.activeOrders")}</h2>
            {d.active_orders.length === 0 ? <p className="text-sm text-muted-foreground">{t("dash.noOrders")}</p> :
              <ul className="divide-y text-sm">{d.active_orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to="/app/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-primary hover:underline">{o.order_number}</Link>
                  <span className="tabular-nums">{eur(Number(o.total))}</span><StatusBadge kind="order" status={o.status} /></li>))}</ul>}
          </section>
          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="font-display font-semibold">{t("dash.myPools")}</h2>
            {d.pools.length === 0 ? <p className="text-sm text-muted-foreground">{t("dash.noPools")} <Link to="/app/group-buy" className="text-primary underline">{t("nav.groupBuy")}</Link></p> :
              <ul className="divide-y text-sm">{d.pools.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to="/app/group-buy/$poolId" params={{ poolId: p.id }} className="text-primary hover:underline">{p.product_name}</Link>
                  <span className="tabular-nums">{Number(p.quantity)} {p.unit}</span><PoolStatus status={p.status} /></li>))}</ul>}
          </section>
        </div>
      </>)}
    </div>
  );
}
