import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bookmark, Camera, Check, Loader2, Package, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrustBadge } from "@/components/trust-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import { identifyMaterial, type LensResponse } from "@/lib/lens.functions";
import { LENS_MAX_PHOTOS, LENS_MAX_PX, lensCanSubmit } from "@/lib/lens";
import { prepPhoto } from "@/lib/image-prep";
import { cn } from "@/lib/utils";

type Spec = string | number | boolean;

export function LensButton({ variant = "ghost", label }: { variant?: "ghost" | "outline"; label?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (<>
    <Button variant={variant} size={label ? "sm" : "icon"} onClick={() => setOpen(true)} aria-label={t("lens.button")}>
      <Camera className={label ? "h-4 w-4 sm:mr-2" : ""} />{label && <span className="hidden sm:inline">{t("lens.button")}</span>}
    </Button>
    {open && <MaterialLensDialog open={open} onOpenChange={setOpen} />}
  </>);
}

export function MaterialLensDialog({ open, onOpenChange, onAskInChat }: { open: boolean; onOpenChange: (o: boolean) => void; onAskInChat?: ((text: string) => void) | undefined }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { data: account } = useAccount();
  const run = useServerFn(identifyMaterial);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<LensResponse | null>(null);
  const [specs, setSpecs] = useState<Record<string, Spec>>({});
  const [slug, setSlug] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [targetRfq, setTargetRfq] = useState("");
  const [qty, setQty] = useState(0);
  const previews = files.map((f) => URL.createObjectURL(f));
  const isSupplier = account?.role === "supplier";

  const drafts = useQuery({
    queryKey: ["lens-drafts", account?.company?.id], enabled: !!res && !isSupplier && !onAskInChat,
    queryFn: async () => (await supabase.from("rfqs").select("id,rfq_number,title").eq("buyer_company_id", account!.company!.id).eq("status", "draft").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  const suppliers = useQuery({
    queryKey: ["lens-suppliers", slug, account?.company?.city],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lens_suppliers", { _category_slug: slug!, _city: isSupplier ? null as never : (account?.company?.city ?? null) as never });
      if (error) throw error;
      const rows = data ?? [];
      setChosen(rows.filter((r) => r.in_region).slice(0, 4).map((r) => r.company_id));
      return rows;
    },
  });

  async function identify() {
    if (!account?.company || !files.length) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) {
        const blob = await prepPhoto(f, LENS_MAX_PX);
        const path = `${account.company.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("material-scans").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      }
      const r = await run({ data: { paths, note, hint: files.map((f) => f.name).join(" "), lang } });
      setRes(r);
      setSpecs(r.result.rfq_item_draft?.specs ?? r.result.likely_specs);
      setSlug(r.result.rfq_item_draft?.category_slug ?? r.result.category_slug);
      setName(r.result.rfq_item_draft?.description ?? r.result.item_name);
      if (r.source === "demo") toast.warning(t("lens.demo"));
    } catch (e) { console.error(e); toast.error(t("lens.failed")); }
    finally { setBusy(false); }
  }

  async function persist(extra: { saved?: boolean }) {
    if (!res) return;
    const draft = { ...(res.result.rfq_item_draft ?? { unit: "pcs", quantity: null }), category_slug: slug, description: name, specs };
    const { error } = await supabase.from("material_scans").update({
      ...extra, result: { ...res.result, rfq_item_draft: draft, chosen_suppliers: chosen } as never,
    }).eq("id", res.scanId);
    if (error) throw error;
  }
  async function requestOffers() {
    try { await persist({}); onOpenChange(false); nav({ to: "/app/create-rfq", search: { scan: res!.scanId } }); }
    catch { toast.error(t("lens.failed")); }
  }
  async function save() {
    try { await persist({ saved: true }); toast.success(t("lens.saved")); } catch { toast.error(t("lens.failed")); }
  }
  async function addToRfq() {
    const rfq = drafts.data?.find((d) => d.id === targetRfq);
    if (!rfq || !lensCanSubmit(qty)) return;
    const { data: cat } = await supabase.from("categories").select("id,default_unit").eq("slug", slug!).maybeSingle();
    const { count } = await supabase.from("rfq_items").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
    const { error } = await supabase.from("rfq_items").insert({ rfq_id: rfq.id, category_id: cat?.id ?? null, description: name, specs: specs as never,
      quantity: qty, unit: res?.result.rfq_item_draft?.unit || cat?.default_unit || null, standard: res?.result.standards_to_ask_for[0] ?? null,
      sort_order: (count ?? 0) + 1, buyer_confirmed: true, ai_confidence: res?.result.confidence ?? null });
    if (error) { toast.error(error.message); return; }
    try { await persist({ saved: true }); } catch { /* scan already stored */ }
    toast.success(t("lens.added").replace("{n}", rfq.rfq_number));
    onOpenChange(false); nav({ to: "/app/rfqs/$rfqId", params: { rfqId: rfq.id } });
  }
  function askChat() {
    const sp = Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join(", ");
    onAskInChat?.(t("lens.chatSummary").replace("{name}", name.replace(/\.+$/, "")).replace("{specs}", sp || "—"));
    persist({ saved: true }).catch(() => undefined);
    onOpenChange(false);
  }
  const pickAlt = (a: { item_name: string; category_slug: string | null }) => { setName(a.item_name); setSlug(a.category_slug); };
  const toggle = (id: string) => setChosen((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);
  const r = res?.result;
  const iSupply = isSupplier && suppliers.data?.some((s) => s.company_id === account?.company?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" />{t("lens.title")}</DialogTitle>
          <DialogDescription>{t("lens.hint")}</DialogDescription>
        </DialogHeader>

        {!r && (<div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFiles((xs) => [...xs, ...Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))].slice(0, LENS_MAX_PHOTOS)); }}>
            <Camera className="h-6 w-6 text-primary" /><span className="font-medium">{t("lens.take")}</span>
            <span className="text-xs text-muted-foreground">{t("lens.photoTips")}</span>
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label={t("lens.take")}
              onChange={(e) => setFiles((xs) => [...xs, ...Array.from(e.target.files ?? [])].slice(0, LENS_MAX_PHOTOS))} />
          </label>
          {files.length > 0 && <div className="flex flex-wrap gap-2">{previews.map((u, i) => (
            <div key={u} className="relative"><img src={u} alt="" className="h-20 w-20 rounded-md object-cover" />
              <button type="button" aria-label="Remove" onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow"><X className="h-3 w-3" /></button></div>))}</div>}
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("lens.note")} />
          <p className="text-xs text-muted-foreground">{t("lens.privacy")}</p>
          <Button className="w-full" onClick={identify} disabled={!files.length || busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("lens.reading")}</> : t("lens.identify")}
          </Button>
        </div>)}

        {r && (<div className="space-y-4">
          {r.safety_note && <div className="flex gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" /><div><p className="font-semibold">{t("lens.safety")}</p><p>{r.safety_note}</p></div></div>}
          {(r.status === "not_a_material" || r.status === "failed") ? (
            <p className="rounded-md border p-4 text-sm">{t(r.status === "failed" ? "lens.failed" : "lens.notMaterial")}</p>
          ) : (<div className="rounded-lg border p-4 space-y-3">
            <div className="flex gap-3">
              {previews[0] && <img src={previews[0]} alt="" className="h-20 w-20 rounded-md object-cover" />}
              <div className="flex-1 space-y-1">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="font-semibold" aria-label={t("lens.itemName")} />
                <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", r.status === "identified" ? "bg-primary/15 text-primary" : "bg-warning/20")}>
                  {Math.round(r.confidence * 100)}% · {t(r.status === "identified" ? "lens.identified" : "lens.uncertain")}
                </span>
              </div>
            </div>
            <p className="text-sm">{r.plain_explanation}</p>
            {r.status === "uncertain" && r.alternatives.length > 0 && <div className="text-sm"><p className="font-medium">{t("lens.didYouMean")}</p>
              <div className="mt-1 flex flex-wrap gap-2">{r.alternatives.map((a) => <Button key={a.item_name} size="sm" variant="outline" onClick={() => pickAlt(a)}>{a.item_name}</Button>)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t("lens.closeUp")}</p></div>}
            {r.visible_markings && <p className="text-sm"><span className="text-muted-foreground">{t("lens.markings")}: </span>{r.visible_markings}</p>}
            {Object.keys(specs).length > 0 && <div><p className="text-sm font-medium">{t("lens.specs")}</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">{Object.entries(specs).map(([k, v]) => (
                <label key={k} className="text-xs"><span className="text-muted-foreground">{k}</span>
                  <Input value={String(v)} onChange={(e) => setSpecs((s) => ({ ...s, [k]: e.target.value }))} className="h-8" /></label>))}</div></div>}
            <List title={t("lens.confirm")} items={r.specs_to_confirm} />
            <List title={t("lens.uses")} items={r.typical_uses} />
            <List title={t("lens.standards")} items={r.standards_to_ask_for} />
            <List title={t("lens.questions")} items={r.questions_to_confirm} />
          </div>)}

          {slug && (<div className="space-y-2">
            <p className="font-display font-semibold">{isSupplier ? t("lens.competitors") : t("lens.who")}</p>
            {isSupplier && <p className={cn("rounded-md p-2 text-sm", iSupply ? "bg-primary/10 text-primary" : "bg-muted")}>{t(iSupply ? "lens.iSupplyYes" : "lens.iSupplyNo")}</p>}
            {suppliers.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {suppliers.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("lens.noSuppliers")}</p>}
            {suppliers.data?.map((s) => {
              const on = chosen.includes(s.company_id);
              return (
                <div key={s.company_id} role={isSupplier ? undefined : "checkbox"} aria-checked={isSupplier ? undefined : on} tabIndex={isSupplier ? undefined : 0}
                  onClick={() => !isSupplier && toggle(s.company_id)} onKeyDown={(e) => { if (!isSupplier && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggle(s.company_id); } }}
                  className={cn("w-full rounded-md border p-3 text-left text-sm", !isSupplier && "cursor-pointer", on && !isSupplier && "border-primary bg-primary/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">{!isSupplier && <span className={cn("grid h-4 w-4 place-items-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>{on && <Check className="h-3 w-3" />}</span>}{s.name}</span>
                    <TrustBadge score={s.trust_score} breakdown={null} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{[s.city, s.country].filter(Boolean).join(", ")}{s.lead_time_days ? ` · ${t("lens.lead").replace("{n}", String(s.lead_time_days))}` : ""}{!s.in_region ? ` · ${t("lens.outRegion")}` : ""}</p>
                  {s.product_name && <p className="mt-1 flex items-center gap-1 text-xs"><Package className="h-3 w-3 text-primary" />{s.product_name}
                    {s.product_price != null && ` · ${s.product_price} ${s.product_currency}`}{s.product_stock != null && ` · ${t("lens.stock")} ${s.product_stock}`}
                    {s.price_updated_at && <span className="text-muted-foreground"> · {t("lens.priceUpdated")} {new Date(s.price_updated_at).toLocaleDateString()}</span>}</p>}
                </div>);
            })}
          </div>)}

          <div className="flex flex-wrap gap-2">
            {onAskInChat && r.status !== "not_a_material" && <Button onClick={askChat}><Send className="mr-2 h-4 w-4" />{t("lens.askChat")}</Button>}
            {!isSupplier && !onAskInChat && slug && <Button onClick={requestOffers}><Send className="mr-2 h-4 w-4" />{t("lens.request")}</Button>}
            {isSupplier && <Button variant="outline" onClick={() => { onOpenChange(false); nav({ to: "/supplier/catalogue" }); }}><Package className="mr-2 h-4 w-4" />{t("lens.addCatalogue")}</Button>}
            <Button variant="outline" onClick={save}><Bookmark className="mr-2 h-4 w-4" />{t("lens.save")}</Button>
            <Button variant="ghost" onClick={() => { setRes(null); setFiles([]); setSlug(null); }}>{t("lens.again")}</Button>
          </div>
          {!isSupplier && !onAskInChat && slug && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">{t("lens.addExisting")}</p>
              {drafts.data?.length === 0 ? <p className="text-xs text-muted-foreground">{t("lens.noDrafts")}</p> : (
                <div className="flex flex-wrap items-end gap-2">
                  <select aria-label={t("lens.chooseRfq")} value={targetRfq} onChange={(e) => setTargetRfq(e.target.value)} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm">
                    <option value="">{t("lens.chooseRfq")}</option>
                    {drafts.data?.map((d) => <option key={d.id} value={d.id}>{d.rfq_number} · {d.title}</option>)}
                  </select>
                  <Input type="number" min={0} aria-label={t("lens.qty")} placeholder={t("lens.qty")} className="h-9 w-28" value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} />
                  <Button size="sm" variant="outline" onClick={addToRfq} disabled={!targetRfq || !lensCanSubmit(qty)}>{t("lens.addExisting")}</Button>
                </div>)}
            </div>)}
          <p className="text-xs text-muted-foreground">{t("ai.label")}</p>
        </div>)}
      </DialogContent>
    </Dialog>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <div className="text-sm"><p className="font-medium">{title}</p><ul className="ml-4 list-disc text-muted-foreground">{items.map((i) => <li key={i}>{i}</li>)}</ul></div>;
}
