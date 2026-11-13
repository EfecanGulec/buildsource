import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/rfq/status-badge";
import { eur } from "@/components/rfq/quote-thread";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/supplier/quotes")({
  head: () => ({ meta: [{ title: "My quotes — BuildSource LT" }] }),
  component: Quotes,
});

function Quotes() {
  const { t } = useI18n();
  const me = useAccount().data?.company?.id;
  const q = useQuery({ queryKey: ["my-quotes", me], enabled: !!me, queryFn: async () => {
    const { data, error } = await supabase.from("quotes")
      .select("id,status,current_version,updated_at,rfq_id,rfqs(rfq_number,title,companies(name)),quote_versions(version,party,total)")
      .eq("supplier_company_id", me!).order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  } });
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.quotes")}</h1>
      {q.isLoading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
      {q.data?.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("sq.empty")}</p>}
      {!!q.data?.length && (
        <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3">
            <th>RFQ</th><th>{t("ord.counterparty")}</th><th>{t("sq.version")}</th><th className="text-right">{t("rfq.total")}</th><th>{t("rfq.status")}</th></tr></thead>
          <tbody>{q.data.map((x) => {
            const v = x.quote_versions.find((y) => y.version === x.current_version);
            return (
              <tr key={x.id} className="border-t [&>td]:px-4 [&>td]:py-3">
                <td><Link to="/supplier/inbox/$rfqId" params={{ rfqId: x.rfq_id }} className="font-mono text-primary hover:underline">{x.rfqs?.rfq_number}</Link>
                  <div className="text-xs text-muted-foreground">{x.rfqs?.title}</div></td>
                <td>{x.rfqs?.companies?.name}</td>
                <td>v{x.current_version} · {v?.party === "buyer" ? t("sq.buyerCounter") : t("sq.yourOffer")}</td>
                <td className="text-right tabular-nums">{v ? eur(Number(v.total)) : "—"}</td>
                <td><StatusBadge kind="quote" status={x.status} /></td>
              </tr>);
          })}</tbody>
        </table></div>)}
    </div>
  );
}
