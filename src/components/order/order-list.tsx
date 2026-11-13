import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/rfq/status-badge";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export function OrderList({ side }: { side: "buyer" | "supplier" }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["orders", side],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders")
        .select("id,order_number,total,status,created_at,buyer:companies!orders_buyer_company_id_fkey(name),supplier:companies!orders_supplier_company_id_fkey(name),rfqs(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.orders")}</h1>
      {q.data?.length === 0 ? <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("ord.empty")}</p> : (
        <div className="rounded-lg border bg-card"><table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3"><th>{t("ord.number")}</th><th>{t("ord.counterparty")}</th><th className="text-right">{t("rfq.total")}</th><th>{t("rfq.status")}</th><th>{t("ord.created")}</th></tr></thead>
          <tbody>{(q.data ?? []).map((o) => (
            <tr key={o.id} className="border-t [&>td]:px-4 [&>td]:py-3">
              <td>{side === "buyer"
                ? <Link to="/app/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-primary hover:underline">{o.order_number}</Link>
                : <Link to="/supplier/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-primary hover:underline">{o.order_number}</Link>}
                <div className="text-xs text-muted-foreground">{o.rfqs?.title}</div></td>
              <td>{side === "buyer" ? o.supplier?.name : o.buyer?.name}</td>
              <td className="text-right tabular-nums">{eur(Number(o.total))}</td>
              <td><StatusBadge kind="order" status={o.status} /></td>
              <td className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-GB")}</td>
            </tr>))}</tbody>
        </table></div>)}
    </div>
  );
}
