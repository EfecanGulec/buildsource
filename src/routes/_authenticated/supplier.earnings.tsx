import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stat, StatSkeleton } from "@/components/dashboard/stat";
import { StatusBadge } from "@/components/rfq/status-badge";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/supplier/earnings")({
  head: () => ({ meta: [{ title: "Earnings — BuildSource LT" }] }),
  component: Earnings,
});

function Earnings() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["earnings"], queryFn: async () => {
    const { data, error } = await supabase.rpc("supplier_earnings");
    if (error) throw error;
    return data;
  } });
  const rows = q.data ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.earnings")}</h1>
      {q.isLoading ? <StatSkeleton /> : (<>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("earn.sales")} value={eur(sum((r) => Number(r.total)))} />
          <Stat label={t("earn.commission")} value={eur(sum((r) => Number(r.commission_amount)))} />
          <Stat label={t("earn.paidOut")} value={eur(sum((r) => (r.paid_out ? Number(r.supplier_payout) : 0)))}
            hint={`${t("earn.pending")} ${eur(sum((r) => (r.paid_out ? 0 : Number(r.supplier_payout))))}`} />
        </div>
        {rows.length === 0 ? <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("earn.empty")}</p> : (
          <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3">
              <th>{t("ord.number")}</th><th>{t("ord.counterparty")}</th><th>{t("rfq.status")}</th>
              <th className="text-right">{t("rfq.total")}</th><th className="text-right">{t("earn.commission")}</th><th className="text-right">{t("agr.payout")}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.order_id} className="border-t [&>td]:px-4 [&>td]:py-3">
                <td><Link to="/supplier/orders/$orderId" params={{ orderId: r.order_id }} className="font-mono text-primary hover:underline">{r.order_number}</Link>
                  <div className="text-xs text-muted-foreground">{r.title}</div></td>
                <td>{r.buyer_name}</td>
                <td><StatusBadge kind="order" status={r.status} /></td>
                <td className="text-right tabular-nums">{eur(Number(r.total))}</td>
                <td className="text-right tabular-nums text-muted-foreground">−{eur(Number(r.commission_amount))} ({(Number(r.commission_rate) * 100).toFixed(1)}%)</td>
                <td className="text-right tabular-nums font-medium">{eur(Number(r.supplier_payout))}<div className="text-xs font-normal text-muted-foreground">{r.paid_out ? t("earn.paid") : t("earn.pending")}</div></td>
              </tr>))}</tbody>
          </table></div>)}
      </>)}
    </div>
  );
}
