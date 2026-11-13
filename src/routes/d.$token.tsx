import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MapPin, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { driverNext, type ShipLine, type ShipStatus } from "@/lib/shipment";

type Driver = {
  status: ShipStatus; planned_date: string | null; lines: ShipLine[]; order_number: string; buyer: string; supplier: string;
  city: string | null; address: string | null; window: string | null; unloading: string | null; access_notes: string | null;
  contact_name: string | null; contact_phone: string | null; events: { status: string; description: string | null; at: string }[];
};

export const Route = createFileRoute("/d/$token")({
  head: () => ({
    meta: [
      { title: "Delivery — BuildSource LT" },
      { name: "description", content: "Driver delivery page for a BuildSource LT order." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Delivery — BuildSource LT" },
      { property: "og:description", content: "Driver delivery page for a BuildSource LT order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { token } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["driver", token],
    queryFn: async () => { const { data, error } = await supabase.rpc("driver_get", { _token: token }); if (error) throw error; return data as unknown as Driver; },
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | boolean>(null);

  async function step(status: ShipStatus, share = false) {
    setBusy(true);
    let lat: number | undefined, lng: number | undefined;
    if (share && "geolocation" in navigator) {
      await new Promise<void>((res) => navigator.geolocation.getCurrentPosition((p) => { lat = p.coords.latitude; lng = p.coords.longitude; res(); }, () => res(), { timeout: 8000 }));
    }
    const { error } = await supabase.rpc("driver_update", { _token: token, _status: status, ...(lat !== undefined && lng !== undefined ? { _lat: lat, _lng: lng } : {}) });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["driver", token] });
    setBusy(false);
  }

  if (q.isLoading) return <Shell><p className="text-muted-foreground">…</p></Shell>;
  if (q.isError || !q.data) return <Shell><p className="text-muted-foreground">{t("drv.invalid")}</p></Shell>;
  const d = q.data;
  const next = driverNext(d.status);

  return (
    <Shell>
      <div className="space-y-1">
        <p className="font-mono text-sm text-muted-foreground">{d.order_number} · {d.supplier}</p>
        <h1 className="font-display text-2xl font-semibold">{d.buyer}</h1>
        <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">{t(`ship.status.${d.status}` as TKey)}</span>
      </div>
      <section className="space-y-2 rounded-lg border bg-card p-4 text-sm">
        <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span><strong>{t("drv.address")}:</strong> {[d.address, d.city].filter(Boolean).join(", ") || "—"}</span></p>
        {(d.contact_name || d.contact_phone) && <p className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-primary" /><span><strong>{t("drv.contact")}:</strong> {d.contact_name} {d.contact_phone && <a className="text-primary underline" href={`tel:${d.contact_phone}`}>{d.contact_phone}</a>}</span></p>}
        {d.planned_date && <p><strong>{t("ship.planned")}:</strong> {d.planned_date}{d.window && ` · ${t(`win.${d.window}` as TKey)}`}</p>}
        {d.unloading && <p><strong>{t("drv.unloading")}:</strong> {t(`unl.${d.unloading}` as TKey)}</p>}
        {d.access_notes && <p><strong>{t("drv.access")}:</strong> {d.access_notes}</p>}
      </section>
      <section className="rounded-lg border bg-card p-4 text-sm">
        <h2 className="mb-2 font-medium">{t("ship.lines")}</h2>
        <ul className="space-y-1">{d.lines.map((l) => <li key={l.key} className="flex justify-between gap-2"><span>{l.name}</span><span className="tabular-nums">{l.quantity} {l.unit}</span></li>)}</ul>
      </section>

      {done !== null || d.status === "delivered" ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-card p-4 text-sm"><CheckCircle2 className="h-5 w-5 text-primary" />{done ? t("drv.doneMismatch") : t("drv.done")}</div>
      ) : next === "picked_up" ? (
        <Button size="lg" className="h-14 w-full text-base" disabled={busy} onClick={() => step("picked_up")}><Truck className="mr-2 h-5 w-5" />{t("drv.pickedUp")}</Button>
      ) : next === "in_transit" ? (
        <div className="space-y-2">
          <Button size="lg" className="h-14 w-full text-base" disabled={busy} onClick={() => step("in_transit")}>{t("drv.onTheWay")}</Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => step("in_transit", true)}><MapPin className="mr-2 h-4 w-4" />{t("drv.onTheWay")} + {t("drv.shareLocation")}</Button>
        </div>
      ) : next === "deliver" ? (
        <DeliverForm token={token} lines={d.lines} onDone={(m) => { setDone(m); qc.invalidateQueries({ queryKey: ["driver", token] }); }} onFail={() => step("failed")} />
      ) : null}

      {d.events.length > 0 && (
        <ol className="space-y-1 border-l-2 border-primary/30 pl-4 text-xs text-muted-foreground">
          {d.events.map((e, i) => <li key={i}><span className="font-medium text-foreground">{t(`ship.status.${e.status}` as TKey)}</span> · {new Date(e.at).toLocaleString("en-GB")}</li>)}
        </ol>)}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink px-4 py-3 text-ink-foreground"><p className="font-display font-semibold">BuildSource LT · {t("drv.title")}</p></header>
      <main className="mx-auto max-w-md space-y-4 p-4">{children}</main>
    </div>);
}

function DeliverForm({ token, lines, onDone, onFail }: { token: string; lines: ShipLine[]; onDone: (mismatch: boolean) => void; onFail: () => void }) {
  const { t } = useI18n();
  const [received, setReceived] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.key, String(l.quantity)])));
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio; ctx.scale(ratio, ratio);
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = getComputedStyle(c).color;
    let drawing = false;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const down = (e: PointerEvent) => { drawing = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: PointerEvent) => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setSigned(true); };
    const up = () => { drawing = false; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); };
  }, []);

  function clear() { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setSigned(false); }

  async function submit() {
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files.slice(0, 5)) {
        const path = `${token}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("delivery-photos").upload(path, f);
        if (error) throw error;
        paths.push(path);
      }
      const { data, error } = await supabase.rpc("driver_deliver", {
        _token: token, _receiver: receiver, _signature: signed ? canvas.current!.toDataURL("image/png") : "",
        _photos: paths, _received: lines.map((l) => ({ key: l.key, received: Number(received[l.key]) })), _notes: notes,
      });
      if (error) throw error;
      onDone(!!data);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  return (
    <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-4 text-sm">
      <h2 className="font-display text-lg font-semibold">{t("drv.delivered")}</h2>
      <div className="space-y-2">{lines.map((l) => (
        <label key={l.key} className="flex items-center justify-between gap-2"><span>{l.name} <span className="text-muted-foreground">({l.quantity} {l.unit})</span></span>
          <Input type="number" inputMode="decimal" min={0} className="w-24" aria-label={`${t("ship.received")} ${l.name}`} value={received[l.key]} onChange={(e) => setReceived({ ...received, [l.key]: e.target.value })} /></label>))}</div>
      <label className="block space-y-1"><span>{t("drv.photos")}</span><Input type="file" accept="image/*" capture="environment" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label>
      <label className="block space-y-1"><span>{t("drv.receiver")}</span><Input value={receiver} onChange={(e) => setReceiver(e.target.value)} /></label>
      <div className="space-y-1">
        <div className="flex items-center justify-between"><span>{t("drv.signature")}</span><button type="button" className="text-xs text-muted-foreground underline" onClick={clear}>{t("drv.clear")}</button></div>
        <canvas ref={canvas} aria-label={t("drv.signature")} className="h-32 w-full touch-none rounded-md border bg-background text-foreground" />
      </div>
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("drv.notes")} />
      <Button size="lg" className="h-14 w-full text-base" disabled={busy || !receiver.trim() || lines.some((l) => received[l.key] === "")} onClick={submit}>{t("drv.finish")}</Button>
      <Button variant="ghost" className="w-full" disabled={busy} onClick={onFail}>{t("drv.failed")}</Button>
    </section>);
}
