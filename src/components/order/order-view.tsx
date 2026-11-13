import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/rfq/status-badge";
import { eur } from "@/components/rfq/quote-thread";
import { PhotoStrip, uploadOrderPhotos } from "@/components/order/photos";
import { SHIPMENT_SELECT, ShipmentsPanel, mismatchPrefill, type Shipment } from "@/components/order/shipments";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import type { Database } from "@/integrations/supabase/types";
import { canDispute, canPayLater, nextSupplierStatuses, stagedSplit } from "@/lib/order";
import { countdownText, useNow } from "@/lib/use-now";

type OrderStatus = Database["public"]["Enums"]["order_status"];
const MILESTONES = ["drawing_approved", "sample_approved", "in_production", "ready"] as const;
const COLS = "id,order_number,rfq_id,total,status,payment_method,staged_payment,created_at,payment_due_at,buyer_company_id,supplier_company_id";

export function OrderView({ id, side }: { id: string; side: "buyer" | "supplier" }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data: o, error } = await supabase.from("orders")
        .select(`${COLS},rfqs(rfq_number,title),pool:group_buy_pools!orders_pool_id_fkey(product_name),buyer:companies!orders_buyer_company_id_fkey(name),supplier:companies!orders_supplier_company_id_fkey(name)`)
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!o) return null;
      const [ev, pay, ms, dis, rev, fin, comm, sh] = await Promise.all([
        supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
        supabase.from("payments").select("*").eq("order_id", id).order("created_at"),
        supabase.from("production_milestones").select("*").eq("order_id", id).order("created_at"),
        supabase.from("disputes").select("*").eq("order_id", id).order("created_at"),
        supabase.from("reviews").select("*").eq("order_id", id).maybeSingle(),
        side === "buyer" ? supabase.from("financing_requests").select("*").eq("order_id", id).maybeSingle() : Promise.resolve({ data: null }),
        side === "supplier" ? supabase.rpc("my_order_commission", { _order: id }) : Promise.resolve({ data: null }),
        supabase.from("shipments").select(SHIPMENT_SELECT).eq("order_id", id).order("created_at"),
      ]);
      return { o, events: ev.data ?? [], payments: pay.data ?? [], milestones: ms.data ?? [], disputes: dis.data ?? [], review: rev.data, fin: fin.data, comm: comm.data?.[0] ?? null, shipments: (sh.data ?? []) as unknown as Shipment[] };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["order", id] }); qc.invalidateQueries({ queryKey: ["orders"] }); };
  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await p;
    if (error) { toast.error(error.message); return false; }
    toast.success(ok); refresh(); return true;
  }

  if (q.isLoading) return <p className="text-muted-foreground">…</p>;
  if (!q.data) return <p className="text-muted-foreground">{t("rfq.notFound")}</p>;
  const { o, events, payments, milestones, disputes, review, fin, comm, shipments } = q.data;
  const prefill = mismatchPrefill(shipments);
  const total = Number(o.total);
  const pendingBalance = payments.find((p) => p.milestone === "delivery" && p.status === "pending");

  return (
    <div className="max-w-4xl space-y-6">
      <Link to={side === "buyer" ? "/app/orders" : "/supplier/orders"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t("nav.orders")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{o.order_number} · {o.rfqs?.rfq_number ?? t("nav.groupBuy")}</p>
          <h1 className="font-display text-2xl font-semibold">{o.rfqs?.title ?? o.pool?.product_name}</h1>
          <p className="text-sm text-muted-foreground">{side === "buyer" ? o.supplier?.name : o.buyer?.name}</p>
        </div>
        <div className="text-right"><StatusBadge kind="order" status={o.status} />
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{eur(total)}</p>
          {comm && <p className="text-xs text-muted-foreground">{t("agr.commission")} {eur(Number(comm.commission_amount))} · {t("ord.payout")} <strong>{eur(Number(comm.supplier_payout))}</strong></p>}
        </div>
      </div>

      {o.status === "awaiting_payment" && o.payment_due_at && <PayDeadline due={o.payment_due_at} side={side} />}
      {side === "buyer" && o.status === "awaiting_payment" && <Checkout total={total} staged={o.staged_payment} onPay={(m, term) => run(supabase.rpc("buyer_pay_order", { _order: id, _method: m, _term_days: term }), t("ord.paid"))} />}

      {payments.length > 0 && (
        <section className="rounded-lg border bg-card p-6 space-y-2 text-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-primary" />{t("ord.payments")}</h2>
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between gap-2 border-t pt-2 first:border-0">
              <span>{t(`ord.milestone.${p.milestone}` as TKey)} · {p.provider === "demo_financing" ? t("ord.payLater") : t("ord.escrow")}</span>
              <span className="tabular-nums">{eur(Number(p.amount))} · {t(`pay.${p.status}` as TKey)}{Number(p.refunded_amount) > 0 && ` (−${eur(Number(p.refunded_amount))})`}</span>
            </div>))}
          {fin && <p className="text-muted-foreground">{t("ord.dueDate").replace("{date}", new Date(new Date(fin.created_at).getTime() + fin.term_days * 864e5).toLocaleDateString("en-GB"))}</p>}
          {side === "buyer" && pendingBalance && ["processing", "shipped", "in_transit", "paid_escrow"].includes(o.status) && (
            <Button onClick={() => run(supabase.rpc("buyer_pay_balance", { _order: id }), t("ord.paid"))}>{t("ord.payBalance").replace("{amount}", eur(Number(pendingBalance.amount)))}</Button>)}
        </section>)}

      {side === "supplier" && nextSupplierStatuses(o.status).length > 0 && (
        <SupplierUpdate orderId={id} options={nextSupplierStatuses(o.status)} onSave={(s, note, photos) => run(supabase.rpc("supplier_update_order", { _order: id, _status: s as OrderStatus, _note: note, _photos: photos }), t("ord.updated"))} />)}

      {(o.staged_payment || milestones.length > 0 || (side === "supplier" && ["paid_escrow", "processing"].includes(o.status))) && (
        <section className="rounded-lg border bg-card p-6 space-y-3 text-sm">
          <h2 className="font-display text-lg font-semibold">{t("ord.milestones")}</h2>
          {milestones.map((m) => (
            <div key={m.id} className="border-t pt-2 first:border-0">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{t(`ms.${m.name}` as TKey)}</span>
                {m.approved_by_buyer ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" />{t("ord.approved")}</span>
                  : side === "buyer" && <Button size="sm" onClick={() => run(supabase.rpc("buyer_approve_milestone", { _milestone: m.id }), t("ord.approved"))}>{t("ord.approve")}</Button>}</div>
              <PhotoStrip paths={m.photo_urls} />
            </div>))}
          {side === "supplier" && ["paid_escrow", "processing"].includes(o.status) && <AddMilestone orderId={id} onAdd={(n, ph) => run(supabase.rpc("supplier_add_milestone", { _order: id, _name: n, _photos: ph }), t("ord.updated"))} />}
        </section>)}

      <ShipmentsPanel orderId={id} orderStatus={o.status} side={side} shipments={shipments} onChange={refresh} />

      {side === "buyer" && (o.status === "delivered" || canDispute(o.status)) && (
        <div className="flex flex-wrap gap-2">
          {o.status === "delivered" && <Button onClick={() => run(supabase.rpc("buyer_accept_delivery", { _order: id }), t("ord.accepted"))}>{t("ord.accept")}</Button>}
          {canDispute(o.status) && <DisputeButton orderId={id} total={total} prefill={prefill} onOpen={(r, d, h, ph) => run(supabase.rpc("buyer_open_dispute", { _order: id, _reason: r, _description: d, _held: h, _photos: ph }), t("ord.disputeOpened"))} />}
        </div>)}

      {disputes.length > 0 && (
        <section className="rounded-lg border border-destructive/30 bg-card p-6 space-y-2 text-sm">
          <h2 className="font-display text-lg font-semibold">{t("ord.disputes")}</h2>
          {disputes.map((d) => (
            <div key={d.id} className="border-t pt-2 first:border-0">
              <div className="flex justify-between gap-2"><span className="font-medium">{d.reason}</span><StatusBadge kind="dispute" status={d.status} /></div>
              {d.description && <p className="text-muted-foreground">{d.description}</p>}
              <p className="text-xs text-muted-foreground">{t("ord.held")}: {eur(Number(d.held_amount))}{d.resolution_note && ` · ${d.resolution_note}`}</p>
              <PhotoStrip paths={d.photo_urls} />
            </div>))}
        </section>)}

      {o.status === "completed" && (review ? (
        <section className="rounded-lg border bg-card p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">{t("ord.yourReview")}</h2>
          <Stars value={review.rating} />{review.comment && <p className="mt-1">{review.comment}</p>}
        </section>) : side === "buyer" && <ReviewForm onSend={(r, c) => run(supabase.from("reviews").insert({ order_id: id, reviewer_company_id: o.buyer_company_id, supplier_company_id: o.supplier_company_id, rating: r, comment: c || null }), t("ord.reviewThanks"))} />)}

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 font-display text-lg font-semibold">{t("ord.timeline")}</h2>
        <ol className="space-y-3 border-l pl-4 text-sm">{[...events].reverse().map((e) => (
          <li key={e.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <div className="flex flex-wrap items-center gap-2"><StatusBadge kind="order" status={e.status} /><span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("en-GB")}</span></div>
            {e.note && <p className="mt-1">{e.note}</p>}<PhotoStrip paths={e.photo_urls} /></li>))}</ol>
      </section>
    </div>
  );
}

function Checkout({ total, staged, onPay }: { total: number; staged: boolean; onPay: (m: "escrow" | "pay_later", term: number) => Promise<boolean> }) {
  const { t } = useI18n();
  const [m, setM] = useState<"escrow" | "pay_later">("escrow");
  const [term, setTerm] = useState("30");
  const [busy, setBusy] = useState(false);
  const split = stagedSplit(total);
  const now = m === "escrow" && staged ? split.first : total;
  return (
    <section className="rounded-lg border-2 border-primary/40 bg-card p-6 space-y-4 text-sm">
      <h2 className="font-display text-lg font-semibold">{t("ord.checkout")}</h2>
      <RadioGroup value={m} onValueChange={(v) => setM(v as "escrow" | "pay_later")} className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-md border p-4 has-[:checked]:border-primary"><RadioGroupItem value="escrow" />
          <span><span className="font-medium">{t("ord.escrow")}</span><span className="block text-muted-foreground">{staged ? t("ord.stagedText") : t("ord.escrowText")}</span></span></label>
        <label className={`flex gap-3 rounded-md border p-4 has-[:checked]:border-primary ${canPayLater(total) ? "cursor-pointer" : "opacity-50"}`}><RadioGroupItem value="pay_later" disabled={!canPayLater(total)} />
          <span><span className="font-medium">{t("ord.payLater")}</span><span className="block text-muted-foreground">{canPayLater(total) ? t("ord.payLaterText") : t("ord.payLaterTooBig")}</span></span></label>
      </RadioGroup>
      {m === "pay_later" && (
        <label className="flex items-center gap-2">{t("ord.term")}
          <Select value={term} onValueChange={setTerm}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="30">30 {t("rfq.days")}</SelectItem><SelectItem value="60">60 {t("rfq.days")}</SelectItem></SelectContent></Select></label>)}
      <Button size="lg" disabled={busy} onClick={async () => { setBusy(true); await onPay(m, Number(term)); setBusy(false); }}>{t("ord.pay").replace("{amount}", eur(now))}</Button>
    </section>
  );
}

function PhotoInput({ onChange }: { onChange: (f: File[]) => void }) {
  const { t } = useI18n();
  return <label className="block space-y-1 text-sm"><span>{t("ord.photos")}</span><Input type="file" accept="image/*" multiple onChange={(e) => onChange(Array.from(e.target.files ?? []))} /></label>;
}

function SupplierUpdate({ orderId, options, onSave }: { orderId: string; options: string[]; onSave: (s: string, note: string, photos: string[]) => Promise<boolean> }) {
  const { t } = useI18n();
  const [s, setS] = useState(options[0]!);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { const paths = await uploadOrderPhotos(orderId, files); if (await onSave(s, note, paths)) { setNote(""); setFiles([]); } }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <section className="rounded-lg border bg-card p-6 space-y-3 text-sm">
      <h2 className="font-display text-lg font-semibold">{t("ord.update")}</h2>
      <Select value={options.includes(s) ? s : options[0]!} onValueChange={setS}><SelectTrigger className="w-60" aria-label={t("ord.update")}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{t(`status.order.${o}` as TKey)}</SelectItem>)}</SelectContent></Select>
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("ord.note")} aria-label={t("ord.note")} />
      <PhotoInput onChange={setFiles} />
      <Button onClick={save} disabled={busy}>{t("ord.save")}</Button>
    </section>
  );
}

function AddMilestone({ orderId, onAdd }: { orderId: string; onAdd: (n: string, photos: string[]) => Promise<boolean> }) {
  const { t } = useI18n();
  const [n, setN] = useState<string>("drawing_approved");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
      <Select value={n} onValueChange={setN}><SelectTrigger className="w-48" aria-label={t("ord.addMilestone")}><SelectValue /></SelectTrigger>
        <SelectContent>{MILESTONES.map((m) => <SelectItem key={m} value={m}>{t(`ms.${m}` as TKey)}</SelectItem>)}</SelectContent></Select>
      <div className="w-64"><PhotoInput onChange={setFiles} /></div>
      <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await onAdd(n, await uploadOrderPhotos(orderId, files)); } catch (e) { toast.error((e as Error).message); } setBusy(false); }}>{t("ord.addMilestone")}</Button>
    </div>
  );
}

function DisputeButton({ orderId, total, prefill, onOpen }: { orderId: string; total: number; prefill: { reason: string; description: string } | null; onOpen: (r: string, d: string, h: number, photos: string[]) => Promise<boolean> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [r, setR] = useState(prefill?.reason ?? ""); const [d, setD] = useState(prefill?.description ?? "");
  const [h, setH] = useState(String(stagedSplit(total).first));
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (<>
    <Button variant="outline" onClick={() => setOpen(true)}>{t("ord.dispute")}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>{t("ord.dispute")}</DialogTitle></DialogHeader>
      <label className="block space-y-1 text-sm"><span>{t("ord.disputeReason")}</span><Input value={r} onChange={(e) => setR(e.target.value)} /></label>
      <label className="block space-y-1 text-sm"><span>{t("ord.disputeDesc")}</span><Textarea rows={3} value={d} onChange={(e) => setD(e.target.value)} /></label>
      <label className="block space-y-1 text-sm"><span>{t("ord.held")}</span><Input type="number" min={0} max={total} value={h} onChange={(e) => setH(e.target.value)} /></label>
      <PhotoInput onChange={setFiles} />
      <DialogFooter><Button variant="destructive" disabled={busy || !r.trim()} onClick={async () => {
        setBusy(true);
        try { if (await onOpen(r, d, Number(h), await uploadOrderPhotos(orderId, files))) setOpen(false); } catch (e) { toast.error((e as Error).message); }
        setBusy(false);
      }}>{t("ord.dispute")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>);
}

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
    <button key={n} type="button" disabled={!onPick} onClick={() => onPick?.(n)} aria-label={`${n} stars`}>
      <Star className={`h-6 w-6 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`} /></button>))}</div>;
}

function ReviewForm({ onSend }: { onSend: (r: number, c: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [r, setR] = useState(5); const [c, setC] = useState("");
  return (
    <section className="rounded-lg border bg-card p-6 space-y-3 text-sm">
      <h2 className="font-display text-lg font-semibold">{t("ord.review")}</h2>
      <Stars value={r} onPick={setR} />
      <Textarea rows={2} value={c} onChange={(e) => setC(e.target.value)} />
      <Button onClick={() => onSend(r, c)}>{t("ord.submitReview")}</Button>
    </section>
  );
}

function PayDeadline({ due, side }: { due: string; side: "buyer" | "supplier" }) {
  const { t } = useI18n();
  const now = useNow(1000);
  const ms = new Date(due).getTime() - now;
  const time = new Date(due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const left = countdownText(due, now);
  const text = ms <= 0 ? t("ord.payExpired") : (side === "buyer" ? t("ord.payDue") : t("ord.payDueSupplier")).replace("{time}", time).replace("{left}", left);
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <span>{text}</span>
      {ms > 0 && <span className="font-display text-xl font-semibold tabular-nums">{left}</span>}
    </div>
  );
}
