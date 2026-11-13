import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SmartIdDialog } from "@/components/smart-id-dialog";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { DeliveryAcceptance, DeliverySummary } from "@/components/rfq/delivery-acceptance";
import { deliveryDetailsSchema, needsDeliveryDetails } from "@/lib/delivery-details";

type Line = { rfq_item_id: string; unit_price: number; quantity: number; line_total: number };

/** Agreement page shared by buyer (/app/agreements) and supplier (/supplier/agreements). */
export function AgreementView({ id, side }: { id: string; side: "buyer" | "supplier" }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [signing, setSigning] = useState(false);
  const [estDate, setEstDate] = useState("");
  const [estTime, setEstTime] = useState("");
  const [latest, setLatest] = useState("");
  const [note, setNote] = useState("");
  const [refusing, setRefusing] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const today = new Date().toISOString().slice(0, 10);
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
  const missingDelivery = needsDeliveryDetails(a.delivery_details_required, a.delivery_details);
  const delivery = deliveryDetailsSchema.safeParse(a.delivery_details);
  const supplierReady = !!a.supplier_signed_at && !!a.delivery_date;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["agreement", id] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); };

  async function signed(code: string) {
    const { error } = side === "supplier"
      ? await supabase.rpc("supplier_sign_agreement", { _agreement: id, _code: code, _date: estDate, _time: estTime })
      : await supabase.rpc("buyer_sign_agreement", { _agreement: id, _code: code, _latest: (latest || null) as string, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success(t("agr.signedToast")); refresh();
  }
  async function refuseDate() {
    const { error } = await supabase.rpc("buyer_reject_delivery_date", { _agreement: id, _reason: refuseReason, _latest: (latest || null) as string });
    if (error) { toast.error(error.message); return; }
    toast.success(t("agr.dateRefused")); setRefusing(false); setRefuseReason(""); refresh();
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
        <p className="text-muted-foreground">{t("rfq.leadTime")}: {a.lead_time_days ?? "—"} {t("rfq.days")} · {t("agr.estDate")}: {a.delivery_date ?? t("agr.estPending")}{a.delivery_time_window ? ` (${a.delivery_time_window})` : ""} · {t("quote.terms")}: {a.payment_terms ?? "—"}</p>
        <p className="text-muted-foreground">{t("rfq.address")}: {a.rfqs?.delivery_city} {a.rfqs?.delivery_address ?? ""}</p>
      </div>
      {delivery.success && <DeliverySummary details={delivery.data} />}
      {a.status === "pending" && missingDelivery && <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t(side === "buyer" ? "delivery.beforeSign" : "delivery.waitBuyer")}</p>
        {side === "buyer" && <DeliveryAcceptance rfqId={a.rfq_id} agreementId={id} onSaved={refresh} />}
      </div>}
      {(a.buyer_latest_date || a.buyer_delivery_note) && <p className="rounded-md border p-3 text-sm">{a.buyer_latest_date && <>{t("agr.latest")}: <strong>{a.buyer_latest_date}</strong>. </>}{a.buyer_delivery_note}</p>}
      <div className="space-y-2">
        <Sig label={t("agr.buyer")} at={a.buyer_signed_at} />
        <Sig label={t("agr.supplier")} at={a.supplier_signed_at} />
      </div>
      {a.status === "pending" && !mySigned && side === "buyer" && !supplierReady && !missingDelivery && <p className="text-sm text-muted-foreground">{t("agr.waitSupplierDate")}</p>}
      {a.status === "pending" && !mySigned && !missingDelivery && side === "supplier" && (
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          {a.delivery_date_rejection && <p role="alert" className="rounded-md border border-warning bg-warning/15 p-3 text-sm sm:col-span-2">{t("agr.buyerRefused")}: {a.delivery_date_rejection}{a.buyer_latest_date ? ` · ${t("agr.latest")}: ${a.buyer_latest_date}` : ""}</p>}
          <p className="text-sm text-muted-foreground sm:col-span-2">{t("agr.supplierDateHelp")}</p>
          <div className="space-y-1.5"><Label htmlFor="est-date">{t("agr.estDate")} *</Label><Input id="est-date" type="date" min={today} value={estDate} onChange={(e) => setEstDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="est-time">{t("agr.estTime")}</Label><Input id="est-time" maxLength={100} placeholder="09:00–12:00" value={estTime} onChange={(e) => setEstTime(e.target.value)} /></div>
        </div>)}
      {a.status === "pending" && !mySigned && side === "buyer" && supplierReady && (
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <p className="text-sm sm:col-span-2">{t("agr.supplierProposed")}: <strong>{a.delivery_date}</strong>{a.delivery_time_window ? ` (${a.delivery_time_window})` : ""}</p>
          <p className="text-sm text-muted-foreground sm:col-span-2">{t("agr.buyerConfirmHelp")}</p>
          <div className="space-y-1.5"><Label htmlFor="latest">{t("agr.latest")}</Label><Input id="latest" type="date" min={today} value={latest} onChange={(e) => setLatest(e.target.value)} /></div>
          {!refusing && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dnote">{t("agr.deliveryNote")}</Label><Textarea id="dnote" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>}
          {refusing && <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="refuse">{t("agr.refuseReason")} *</Label>
            <Textarea id="refuse" rows={2} maxLength={1000} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
            <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={!refuseReason.trim()} onClick={refuseDate}>{t("agr.sendRefusal")}</Button><Button variant="ghost" onClick={() => setRefusing(false)}>{t("quote.cancel")}</Button></div>
          </div>}
        </div>)}
      {a.status === "pending" && !mySigned && !refusing && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={missingDelivery || (side === "supplier" ? !estDate : !supplierReady)} onClick={() => setSigning(true)}>{t(side === "buyer" ? "agr.confirmSign" : "agr.sign")}</Button>
          {side === "buyer" && supplierReady && <Button variant="outline" onClick={() => setRefusing(true)}>{t("agr.refuseDate")}</Button>}
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
