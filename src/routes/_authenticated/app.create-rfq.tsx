import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MatchingPools } from "@/components/pool/matching-pools";
import { useState } from "react";
import { Building2, Camera, Check, Hammer, Loader2, Package, Plus, Sofa, Store, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { snapSource } from "@/lib/snap.functions";
import { canConfirmAll, isLowConfidence } from "@/lib/snap";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpecFields, specsSummary } from "@/components/rfq/spec-fields";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { isoWeek, kitQuantity, type FieldDef } from "@/lib/rfq";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type ProjectType = Database["public"]["Enums"]["project_type"];
type Item = { category_id: string; description: string; specs: Record<string, string | number | boolean>; quantity: number; unit: string; standard: string; waste_pct: number; confidence: number | null; confirmed: boolean; reasoning?: string };

export const Route = createFileRoute("/_authenticated/app/create-rfq")({
  head: () => ({ meta: [{ title: "Create RFQ — BuildSource LT" }] }),
  component: CreateRfq,
});

const TYPES: { v: ProjectType; icon: typeof Hammer }[] = [
  { v: "new_construction", icon: Building2 }, { v: "renovation", icon: Hammer },
  { v: "interior_design", icon: Sofa }, { v: "business_fitout", icon: Store },
];
const STEPS = ["rfq.step.project", "rfq.step.items", "rfq.step.delivery", "rfq.step.review"] as const;
const blankItem = (): Item => ({ category_id: "", description: "", specs: {}, quantity: 1, unit: "", standard: "", waste_pct: 0, confidence: null, confirmed: true });

function CreateRfq() {
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [kitId, setKitId] = useState<string>("");
  const [kitSize, setKitSize] = useState(40);
  const [delivery, setDelivery] = useState({ city: account?.company?.city ?? "", address: "", date: "", unloading: "manual", window: "any", access: "", contact: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [reading, setReading] = useState(false);
  const [uploadPaths, setUploadPaths] = useState<string[]>([]);
  const runSnap = useServerFn(snapSource);

  const refs = useQuery({
    queryKey: ["rfq-refs"],
    queryFn: async () => {
      const [{ data: cats }, { data: kits }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("kits").select("*").order("name"),
      ]);
      return { cats: cats ?? [], kits: kits ?? [] };
    },
  });
  const cats = refs.data?.cats ?? [];
  const parents = cats.filter((c) => !c.parent_id);
  const catById = new Map(cats.map((c) => [c.id, c]));

  const update = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const applyKit = () => {
    const kit = refs.data?.kits.find((k) => k.id === kitId);
    if (!kit) return;
    if (!projectType) setProjectType(kit.project_type);
    const vars = { seats: kitSize, facade_m2: kitSize, floors: Math.max(1, Math.round(kitSize / 100)) };
    const ki = (kit.items as { category_id: string; description: string; specs: Item["specs"]; quantity_formula: string; unit: string }[]);
    setItems(ki.map((k) => ({ ...blankItem(), category_id: k.category_id, description: k.description, specs: k.specs ?? {}, unit: k.unit, quantity: kitQuantity(k.quantity_formula, vars) })));
    if (!title) setTitle(kit.name);
    toast.success(t("rfq.kitApplied"));
  };

  async function readFiles() {
    if (!account?.company || !files.length) return;
    setReading(true);
    try {
      const paths: string[] = [];
      for (const f of files) {
        const path = `${account.company.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("rfq-uploads").upload(path, f, { contentType: f.type });
        if (error) throw error;
        paths.push(path);
      }
      setUploadPaths(paths);
      const res = await runSnap({ data: { paths, projectType, notes } });
      if (res.source === "failed" || !res.items.length) { toast.error(t("snap.failed")); return; }
      const bySlug = new Map(cats.map((c) => [c.slug, c]));
      setItems(res.items.map((i) => ({
        category_id: bySlug.get(i.category_slug)?.id ?? "", description: i.description, specs: i.specs, quantity: i.quantity,
        unit: i.unit || bySlug.get(i.category_slug)?.default_unit || "", standard: i.standard ?? "", waste_pct: i.waste_pct,
        confidence: i.confidence, confirmed: false, reasoning: i.reasoning,
      })));
      if (res.source === "demo") toast.warning(t("snap.demo"));
      else toast.success(t("snap.done").replace("{n}", String(res.items.length)));
    } catch (e) {
      toast.error(t("snap.failed"));
      console.error(e);
    } finally { setReading(false); }
  }
  const allReviewed = canConfirmAll(items.map((i) => ({ confidence: i.confidence, reviewed: i.confirmed })));
  const fromAi = items.some((i) => i.confidence !== null);

  const itemsValid = items.length > 0 && items.every((i) => i.category_id && i.description.trim() && i.quantity > 0 && i.confirmed);
  const canNext = [!!projectType && !!title.trim(), itemsValid, !!delivery.city.trim() && !!delivery.date, true][step];

  async function save(submit: boolean) {
    if (!account?.company || !projectType) return;
    setSaving(true);
    const kit = refs.data?.kits.find((k) => k.id === kitId);
    const { data: rfq, error } = await supabase.from("rfqs").insert({
      buyer_company_id: account.company.id, project_type: projectType, title: title.trim(), description: description.trim() || null,
      delivery_city: delivery.city.trim(), delivery_address: delivery.address.trim() || null,
      unloading: delivery.unloading, delivery_window: delivery.window, site_access_notes: delivery.access.trim() || null,
      delivery_date_requested: delivery.date || null, delivery_week: delivery.date ? isoWeek(delivery.date) : null,
      status: "draft", source: fromAi ? "snap_source" : kit ? "kit" : "manual", ai_upload_urls: fromAi ? uploadPaths : [],
    }).select("id,rfq_number").single();
    if (error || !rfq) { setSaving(false); toast.error(error?.message ?? "Error"); return; }
    const { error: e2 } = await supabase.from("rfq_items").insert(items.map((i, n) => ({
      rfq_id: rfq.id, category_id: i.category_id, description: i.description.trim(), specs: i.specs, quantity: i.quantity,
      unit: i.unit || catById.get(i.category_id)?.default_unit || null, standard: i.standard || null, waste_pct: i.waste_pct, sort_order: n + 1, buyer_confirmed: i.confirmed, ai_confidence: i.confidence,
    })));
    if (e2) { setSaving(false); toast.error(e2.message); return; }
    // Submitting after items exist lets the database match suppliers on the full item list.
    if (submit) {
      const { error: e3 } = await supabase.from("rfqs").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", rfq.id);
      if (e3) { setSaving(false); toast.error(e3.message); return; }
    }
    setSaving(false);
    toast.success(t(submit ? "rfq.submitted" : "rfq.saved").replace("{n}", rfq.rfq_number));
    qc.invalidateQueries({ queryKey: ["rfqs"] });
    nav({ to: "/app/rfqs/$rfqId", params: { rfqId: rfq.id } });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.createRfq")}</h1>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
            i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary text-primary" : "text-muted-foreground")}>
            {i < step ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}{t(s)}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border bg-card p-6 space-y-5">
        {step === 0 && (<>
          <div className="grid gap-3 sm:grid-cols-4">
            {TYPES.map(({ v, icon: Icon }) => (
              <button key={v} type="button" onClick={() => setProjectType(v)} aria-pressed={projectType === v}
                className={cn("rounded-lg border p-4 text-left transition-colors", projectType === v ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                <Icon className="mb-2 h-5 w-5 text-primary" /><span className="text-sm font-medium">{t(`project.${v}` as TKey)}</span>
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-sm"><span>{t("rfq.title")}</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("rfq.titlePh")} /></label>
          <label className="block space-y-1 text-sm"><span>{t("rfq.description")}</span>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label>
          <div className="rounded-md border border-dashed p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t("rfq.startKit")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <Select value={kitId} onValueChange={setKitId}>
                <SelectTrigger className="w-72"><SelectValue placeholder={t("rfq.chooseKit")} /></SelectTrigger>
                <SelectContent>{refs.data?.kits.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.kitSize")}</span>
                <Input type="number" className="w-28" value={kitSize} onChange={(e) => setKitSize(Number(e.target.value))} /></label>
              <Button variant="outline" onClick={applyKit} disabled={!kitId}>{t("rfq.applyKit")}</Button>
            </div>
          </div>
        </>)}

        {step === 1 && (<>
          <p className="text-sm text-muted-foreground">{t("rfq.itemsHint")}</p>
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Camera className="h-4 w-4 text-primary" />{t("snap.title")}</p>
            <p className="text-xs text-muted-foreground">{t("snap.hint")}</p>
            <Input type="file" multiple accept="image/*,application/pdf" aria-label={t("snap.title")}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).filter((f) => f.size <= 20 * 1024 * 1024).slice(0, 5))} />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("snap.notes")} />
            <Button onClick={readFiles} disabled={!files.length || reading}>
              {reading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("snap.reading")}</> : t("snap.analyse")}
            </Button>
          </div>
          {fromAi && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-3 text-sm">
              <span>{allReviewed ? t("snap.mustConfirm") : t("snap.confirmAllHint")}</span>
              <Button size="sm" variant="outline" disabled={!allReviewed}
                onClick={() => setItems((xs) => xs.map((x) => ({ ...x, confirmed: true })))}><Check className="mr-1 h-4 w-4" />{t("snap.confirmAll")}</Button>
            </div>
          )}
          {items.map((it, i) => {
            const cat = catById.get(it.category_id);
            const low = it.confidence !== null && isLowConfidence(it.confidence);
            return (
              <div key={i} data-low={low || undefined} className={cn("rounded-md border p-4 space-y-3", low && !it.confirmed && "border-warning bg-warning/15", low && it.confirmed && "border-warning/50")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t("rfq.item")} {i + 1}
                    {it.confidence !== null && <span className={cn("ml-2 rounded px-1.5 py-0.5 text-xs tabular-nums", low ? "bg-warning/30" : "bg-primary/10 text-primary")}>
                      {t("snap.confidence")} {Math.round(it.confidence * 100)}%</span>}</span>
                  {it.confidence !== null && <label className="ml-auto flex items-center gap-2 text-sm">
                    <Checkbox checked={it.confirmed} onCheckedChange={(v) => update(i, { confirmed: v === true })} aria-label={`${t("snap.confirm")} ${i + 1}`} />{t("snap.confirm")}</label>}
                  <Button variant="ghost" size="icon" aria-label={t("rfq.removeItem")} disabled={items.length === 1}
                    onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.category")}</span>
                    <Select value={it.category_id} onValueChange={(v) => update(i, { category_id: v, specs: {}, unit: catById.get(v)?.default_unit ?? "" })}>
                      <SelectTrigger><SelectValue placeholder={t("rfq.chooseCategory")} /></SelectTrigger>
                      <SelectContent>{parents.map((p) => (
                        <SelectGroup key={p.id}><SelectLabel>{p.name_en}</SelectLabel>
                          {cats.filter((c) => c.parent_id === p.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
                        </SelectGroup>))}
                      </SelectContent>
                    </Select></label>
                  <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.itemDescription")}</span>
                    <Input value={it.description} onChange={(e) => update(i, { description: e.target.value })} /></label>
                </div>
                {it.reasoning && <p className="text-xs text-muted-foreground">{t("snap.why")}: {it.reasoning}</p>}
                {cat && <SpecFields template={(cat.field_template as FieldDef[]) ?? []} value={it.specs} onChange={(specs) => update(i, { specs })} />}
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.quantity")}</span>
                    <Input type="number" min={0} value={it.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} /></label>
                  <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.unit")}</span>
                    <Input value={it.unit} onChange={(e) => update(i, { unit: e.target.value })} /></label>
                  <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.standard")}</span>
                    <Input value={it.standard} placeholder="EN 13163" onChange={(e) => update(i, { standard: e.target.value })} /></label>
                  <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t("rfq.waste")}</span>
                    <Input type="number" min={0} value={it.waste_pct} onChange={(e) => update(i, { waste_pct: Number(e.target.value) })} /></label>
                </div>
              </div>
            );
          })}
          <Button variant="outline" onClick={() => setItems((xs) => [...xs, blankItem()])}><Plus className="mr-2 h-4 w-4" />{t("rfq.addItem")}</Button>
        </>)}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>{t("rfq.city")}</span>
              <Input value={delivery.city} onChange={(e) => setDelivery({ ...delivery, city: e.target.value })} /></label>
            <label className="space-y-1 text-sm"><span>{t("rfq.address")}</span>
              <Input value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} /></label>
            <label className="space-y-1 text-sm"><span>{t("rfq.date")}</span>
              <Input type="date" value={delivery.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDelivery({ ...delivery, date: e.target.value })} /></label>
            <div className="space-y-1 text-sm"><span>{t("rfq.week")}</span>
              <p className="flex h-10 items-center font-mono">{delivery.date ? isoWeek(delivery.date) : "—"}</p></div>
            <label className="space-y-1 text-sm"><span>{t("rfq.unloading")}</span>
              <Select value={delivery.unloading} onValueChange={(v) => setDelivery({ ...delivery, unloading: v })}><SelectTrigger aria-label={t("rfq.unloading")}><SelectValue /></SelectTrigger>
                <SelectContent>{["manual", "crane_needed", "forklift_on_site"].map((u) => <SelectItem key={u} value={u}>{t(`unl.${u}` as TKey)}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span>{t("rfq.window")}</span>
              <Select value={delivery.window} onValueChange={(v) => setDelivery({ ...delivery, window: v })}><SelectTrigger aria-label={t("rfq.window")}><SelectValue /></SelectTrigger>
                <SelectContent>{["morning", "afternoon", "any"].map((u) => <SelectItem key={u} value={u}>{t(`win.${u}` as TKey)}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm"><span>{t("rfq.siteContact")}</span>
              <Input value={delivery.contact} onChange={(e) => setDelivery({ ...delivery, contact: e.target.value })} /></label>
            <label className="space-y-1 text-sm"><span>{t("rfq.sitePhone")}</span>
              <Input type="tel" value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} /></label>
            <label className="space-y-1 text-sm sm:col-span-2"><span>{t("rfq.access")}</span>
              <Input value={delivery.access} onChange={(e) => setDelivery({ ...delivery, access: e.target.value })} /></label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t("rfq.title")}</dt><dd className="font-medium">{title}</dd></div>
              <div><dt className="text-muted-foreground">{t("rfq.step.project")}</dt><dd>{projectType && t(`project.${projectType}` as TKey)}</dd></div>
              <div><dt className="text-muted-foreground">{t("rfq.step.delivery")}</dt><dd>{delivery.city}{delivery.address && `, ${delivery.address}`}</dd></div>
              <div><dt className="text-muted-foreground">{t("rfq.date")}</dt><dd>{delivery.date} ({delivery.date && isoWeek(delivery.date)})</dd></div>
            </dl>
            <table className="w-full">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">{t("rfq.category")}</th><th>{t("rfq.itemDescription")}</th><th className="text-right">{t("rfq.quantity")}</th></tr></thead>
              <tbody>{items.map((it, i) => (
                <tr key={i} className="border-t align-top"><td className="py-2">{catById.get(it.category_id)?.name_en}</td>
                  <td>{it.description}<div className="text-xs text-muted-foreground">{specsSummary(it.specs)}</div></td>
                  <td className="text-right tabular-nums">{it.quantity} {it.unit}</td></tr>))}
              </tbody>
            </table>
            <MatchingPools categoryIds={items.map((i) => i.category_id).filter(Boolean)} />
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>{t("rfq.back")}</Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>{t("rfq.next")}</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>{t("rfq.saveDraft")}</Button>
            <Button onClick={() => save(true)} disabled={saving}>{t("rfq.submit")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
