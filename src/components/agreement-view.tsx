import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SmartIdDialog } from "@/components/smart-id-dialog";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type Line = { rfq_item_id: string; unit_price: number; quantity: number; line_total: number };

/** Agreement page shared by buyer (/app/agreements) and supplier (/supplier/agreements). */
export function AgreementView({ id, side }: { id: string; side: "buyer" | "supplier" }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [signing, setSigning] = useState(false);
  const q = useQuery({
    queryKey: ["agreement", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("agreements")
        .select("*, rfqs(id,rfq_number,title,delivery_city,delivery_address,companies(name),rfq_items(id,description,unit)), quotes(companies(name)), quote_versions(*)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: order } = await supabase.from("orders").select("id,order_number,status").eq("agreement_id", id).maybeSingle();
      const { data: comm } = side === "supplier" && order ? await supabase.rpc("my_order_commission", { _order: order.id }) : { data: null };
      return { a: data, order, comm: comm?.[0] ?? null };
    },
  });
  if (q.isLoading) return <p className="text-muted-foreground">…</p>;
  if (!q.data) return <p className="text-muted-foreground">{t("rfq.notFound")}</p>;
  const { a, order, comm } = q.data;
  const v = a.quote_versions;
  const names = new Map((a.rfqs?.rfq_items ?? []).map((i) => [i.id, `${i.description}`]));
  const mySigned = side === "buyer" ? a.buyer_signed_at : a.supplier_signed_at;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["agreement", id] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); };

  async function signed(code: string) {
    const { error } = await supabase.rpc("sign_agreement", { _agreement: id, _code: code });
    if (error) { toast.error(error.message); return; }
    toast.success(t("agr.signedToast")); refresh();
  }
  async function cancel() {
    const { error } = await supabase.rpc("cancel_agreement", { _agreement: id });
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  const Sig = ({ label, at }: { label: string; at: string | null }) => (
    <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
      {at ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
      <span className="font-medium">{label}</span>
      <span className="ml-auto text-muted-foreground">{at ? `${t("agr.signedAt")} ${new Date(at).toLocaleString("en-GB")}` : t("agr.waiting")}</span>
    </div>);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{a.rfqs?.rfq_number}</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><FileSignature className="h-6 w-6 text-primary" />{t("agr.title")}</h1>
        <p className="text-sm text-muted-foreground">{a.rfqs?.title} · {a.rfqs?.companies?.name} ↔ {a.quotes?.companies?.name}</p>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3 text-sm">
        <ul className="space-y-1">{((v?.lines as Line[]) ?? []).map((l) => (
          <li key={l.rfq_item_id} className="flex justify-between gap-2"><span>{names.get(l.rfq_item_id)}</span>
            <span className="tabular-nums">{Number(l.quantity)} × {eur(Number(l.unit_price))} = {eur(Number(l.line_total))}</span></li>))}</ul>
        <div className="flex justify-between border-t pt-2"><span>{t("quote.deliveryCost")}</span><span className="tabular-nums">{eur(Number(v?.delivery_cost ?? 0))}</span></div>
        <div className="flex justify-between font-display text-lg font-semibold"><span>{t("rfq.total")}</span><span className="tabular-nums">{eur(Number(a.total))}</span></div>
        <p className="text-muted-foreground">{t("rfq.leadTime")}: {a.lead_time_days ?? "—"} {t("rfq.days")} · {t("rfq.date")}: {a.delivery_date ?? "—"} · {t("quote.terms")}: {a.payment_terms ?? "—"}</p>
        <p className="text-muted-foreground">{t("rfq.address")}: {a.rfqs?.delivery_city} {a.rfqs?.delivery_address ?? ""}</p>
      </div>
      <div className="space-y-2">
        <Sig label={t("agr.buyer")} at={a.buyer_signed_at} />
        <Sig label={t("agr.supplier")} at={a.supplier_signed_at} />
      </div>
      {a.status === "pending" && !mySigned && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSigning(true)}>{t("agr.sign")}</Button>
          <Button variant="ghost" onClick={cancel}>{t("agr.cancel")}</Button>
        </div>)}
      {a.status === "pending" && mySigned && <p className="text-sm text-muted-foreground">{t("agr.waitOther")}</p>}
      {a.status === "cancelled" && <p className="rounded-md bg-muted p-3 text-sm">{t("agr.cancelled")}</p>}
      {order && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm space-y-1">
          <p className="font-medium">{t("agr.orderCreated").replace("{n}", order.order_number)}</p>
          {comm && <p>{t("agr.commission")}: {eur(Number(comm.commission_amount))} ({(Number(comm.commission_rate) * 100).toFixed(2)}%) · {t("agr.payout")}: <strong>{eur(Number(comm.supplier_payout))}</strong></p>}
          <Link className="text-primary underline" to={side === "buyer" ? "/app/orders/$orderId" : "/supplier/orders/$orderId"} params={{ orderId: order.id }}>{t("nav.orders")}</Link>
        </div>)}
      <SmartIdDialog open={signing} onOpenChange={setSigning} onConfirmed={signed} title={t("agr.sign")} />
    </div>
  );
}
