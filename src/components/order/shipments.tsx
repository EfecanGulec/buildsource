import { useState } from "react";
import { AlertTriangle, Copy, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoStrip } from "@/components/order/photos";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { METHODS, isLate, mismatchSummary, supplierNext, type ShipLine, type ShipMethod, type ShipStatus } from "@/lib/shipment";

export type Shipment = {
  id: string; method: string; carrier: string | null; tracking_number: string | null; driver_token: string | null;
  planned_date: string | null; status: string; lines: unknown; created_at: string;
  tracking_events: { id: string; status: string; description: string | null; location: string | null; source: string; occurred_at: string }[];
  proof_of_delivery: { receiver_name: string; signature_url: string | null; photo_urls: string[]; line_quantities: unknown; mismatch: boolean; notes: string | null }[] | { receiver_name: string; signature_url: string | null; photo_urls: string[]; line_quantities: unknown; mismatch: boolean; notes: string | null } | null;
};
export const SHIPMENT_SELECT = "id,method,carrier,tracking_number,driver_token,planned_date,status,lines,created_at,tracking_events(id,status,description,location,source,occurred_at),proof_of_delivery(receiver_name,signature_url,photo_urls,line_quantities,mismatch,notes)";

export const podOf = (s: Shipment) => (Array.isArray(s.proof_of_delivery) ? s.proof_of_delivery[0] : s.proof_of_delivery) ?? null;

/** Dispute text pre-filled from any proof of delivery whose quantities differ. */
export function mismatchPrefill(shipments: Shipment[]) {
  const parts = shipments.flatMap((s) => {
    const p = podOf(s);
    return p?.mismatch ? [mismatchSummary(s.lines as ShipLine[], p.line_quantities as { key: string; received: number }[])] : [];
  }).filter(Boolean);
  return parts.length ? { reason: "Quantity mismatch at delivery", description: parts.join("; ") } : null;
}

export function ShipmentsPanel({ orderId, orderStatus, side, shipments, onChange }: {
  orderId: string; orderStatus: string; side: "buyer" | "supplier"; shipments: Shipment[]; onChange: () => void;
}) {
  const { t } = useI18n();
  const canPlan = side === "supplier" && ["paid_escrow", "processing", "shipped", "in_transit"].includes(orderStatus);
  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await p;
    if (error) { toast.error(error.message); return false; }
    toast.success(ok); onChange(); return true;
  }
  if (!shipments.length && !canPlan) return null;
  return (
    <section className="rounded-lg border bg-card p-6 space-y-4 text-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Truck className="h-5 w-5 text-primary" />{t("ship.title")}</h2>
      {!shipments.length && <p className="text-muted-foreground">{t("ship.none")}</p>}
      {shipments.map((s) => {
        const pod = podOf(s);
        const status = s.status as ShipStatus;
        const next = side === "supplier" ? supplierNext(s.method as ShipMethod, status) : [];
        const link = s.driver_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/d/${s.driver_token}` : null;
        return (
          <div key={s.id} className="space-y-3 border-t pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{t(`ship.method.${s.method}` as TKey)}{s.tracking_number && ` · ${s.carrier ?? ""} ${s.tracking_number}`}</p>
                {s.planned_date && <p className="text-muted-foreground">{t("ship.planned")}: {s.planned_date}</p>}
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">{t(`ship.status.${s.status}` as TKey)}</span>
            </div>
            {isLate(s.planned_date, status) && <p className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" />{t("ship.late")}</p>}
            {side === "supplier" && link && status !== "delivered" && (
              <div className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground">{t("ship.driverLink")}:</span>
                <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-xs">{link}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success(t("ship.copied")); }}><Copy className="mr-1 h-3.5 w-3.5" />{t("ship.copy")}</Button></div>)}
            <ol className="space-y-1 border-l-2 border-primary/30 pl-4">
              {s.tracking_events.slice().sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).map((e) => (
                <li key={e.id}><span className="font-medium">{t(`ship.status.${e.status}` as TKey)}</span>
                  <span className="text-muted-foreground"> · {new Date(e.occurred_at).toLocaleString("en-GB")}{e.description && ` · ${e.description}`}{e.location && ` · ${e.location}`}</span></li>))}
            </ol>
            {pod && (
              <div className={`rounded-md border p-3 space-y-2 ${pod.mismatch ? "border-destructive/50" : ""}`}>
                <p className="font-medium">{t("ship.pod")} · {t("ship.receivedBy")} {pod.receiver_name}</p>
                <ul className="text-muted-foreground">{(s.lines as ShipLine[]).map((l) => {
                  const got = (pod.line_quantities as { key: string; received: number }[]).find((r) => r.key === l.key)?.received;
                  return <li key={l.key} className={got !== Number(l.quantity) ? "text-destructive" : ""}>{l.name}: {got ?? "—"} / {l.quantity} {l.unit}</li>;
                })}</ul>
                {pod.notes && <p>{pod.notes}</p>}
                {pod.signature_url?.startsWith("data:image/") && <img src={pod.signature_url} alt={t("drv.signature")} className="h-16 rounded border bg-background" />}
                <PhotoStrip paths={pod.photo_urls} bucket="delivery-photos" />
                {pod.mismatch && <p className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" />{t("ship.mismatch")}{side === "buyer" && `. ${t("ship.disputeHint")}`}</p>}
              </div>)}
            {next.length > 0 && <StatusUpdate options={next} onSave={(st, d) => run(supabase.rpc("supplier_update_shipment", { _shipment: s.id, _status: st, _desc: d }), t("ship.updated"))} />}
            {side === "buyer" && s.method === "pickup" && status === "ready_for_pickup" && (
              <Button onClick={() => run(supabase.rpc("buyer_confirm_pickup", { _shipment: s.id }), t("ship.updated"))}>{t("ship.confirmPickup")}</Button>)}
          </div>);
      })}
      {canPlan && <PlanShipment onCreate={(m, c, tr, d) => run(supabase.rpc("supplier_create_shipment", { _order: orderId, _method: m, _carrier: c, _tracking: tr, _planned: (d || null) as string }), t("ship.created"))} />}
    </section>
  );
}

function StatusUpdate({ options, onSave }: { options: ShipStatus[]; onSave: (s: ShipStatus, d: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [s, setS] = useState<ShipStatus>(options[0]!);
  const [d, setD] = useState("");
  const cur = options.includes(s) ? s : options[0]!;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select value={cur} onValueChange={(v) => setS(v as ShipStatus)}><SelectTrigger className="w-48" aria-label={t("ship.update")}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{t(`ship.status.${o}` as TKey)}</SelectItem>)}</SelectContent></Select>
      <Input className="w-64" value={d} onChange={(e) => setD(e.target.value)} placeholder={t("ord.note")} aria-label={t("ord.note")} />
      <Button variant="outline" onClick={async () => { if (await onSave(cur, d)) setD(""); }}>{t("ship.update")}</Button>
    </div>);
}

function PlanShipment({ onCreate }: { onCreate: (m: ShipMethod, carrier: string, tracking: string, date: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [m, setM] = useState<ShipMethod>("supplier_own");
  const [carrier, setCarrier] = useState(""); const [tracking, setTracking] = useState(""); const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-medium">{t("ship.plan")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span>{t("ship.method")}</span>
          <Select value={m} onValueChange={(v) => setM(v as ShipMethod)}><SelectTrigger aria-label={t("ship.method")}><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((x) => <SelectItem key={x} value={x}>{t(`ship.method.${x}` as TKey)}</SelectItem>)}</SelectContent></Select></label>
        <label className="space-y-1"><span>{t("ship.planned")}</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {m === "carrier" && <>
          <label className="space-y-1"><span>{t("ship.carrier")}</span><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DPD" /></label>
          <label className="space-y-1"><span>{t("ship.tracking")}</span><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></label>
        </>}
      </div>
      <Button disabled={busy || (m === "carrier" && !tracking.trim())} onClick={async () => { setBusy(true); if (await onCreate(m, carrier, tracking, date)) { setTracking(""); setCarrier(""); } setBusy(false); }}>{t("ship.create")}</Button>
    </div>);
}
