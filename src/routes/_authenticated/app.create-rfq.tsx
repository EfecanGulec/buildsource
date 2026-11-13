import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MatchingPools } from "@/components/pool/matching-pools";
import { useEffect, useState } from "react";
import { lensProducts, type LensResult, type LensProduct } from "@/lib/lens";
import { lensItemPhotos } from "@/lib/lens-item-photos";
import { LensButton } from "@/components/lens/material-lens";
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
type Item = { category_id: string; description: string; specs: Record<string, string | number | boolean>; quantity: number; unit: string; standard: string; waste_pct: number; confidence: number | null; confirmed: boolean; reasoning?: string; itemTitle?: string; photoPaths?: string[] };

export const Route = createFileRoute("/_authenticated/app/create-rfq")({
  head: () => ({ meta: [{ title: "Create RFQ — BuildSource LT" }, { name: "description", content: "Review materials, photos and potential suppliers before sending your BuildSource LT request." }, { property: "og:title", content: "Create RFQ — BuildSource LT" }, { property: "og:description", content: "Prepare a multi-product request and choose your suppliers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { scan?: string } => (typeof s["scan"] === "string" ? { scan: s["scan"] } : {}),
  component: CreateRfq,
});

const TYPES: { v: ProjectType; icon: typeof Hammer }[] = [
  { v: "new_construction", icon: Building2 }, { v: "renovation", icon: Hammer },
  { v: "interior_design", icon: Sofa }, { v: "business_fitout", icon: Store },
];
const STEPS = ["rfq.step.projectItems", "rfq.step.confirm"] as const;
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
  const { scan } = Route.useSearch();
  const [preferred, setPreferred] = useState<string[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const photoPaths = [...new Set(items.flatMap((item) => item.photoPaths ?? []))];
  const photoUrls = useQuery({
    queryKey: ["rfq-composer-photos", account?.user.id, photoPaths],
    enabled: !!account?.user.id && photoPaths.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("material-scans").createSignedUrls(photoPaths, 600);
      if (error) throw error;
      return Object.fromEntries((data ?? []).flatMap((photo) => photo.path && photo.signedUrl ? [[photo.path, photo.signedUrl]] : []));
    },
  });
  const renderItemPhotos = (item: Item) => item.photoPaths?.length ? (
    <div className="space-y-2">
      <h3 className="break-words text-base font-semibold">{item.itemTitle || item.description}</h3>
      <div className="flex flex-wrap gap-2">
        {item.photoPaths.map((path, index) => {
          const url = photoUrls.data?.[path];
          return url ? <img key={path} src={url} alt={`${item.itemTitle || item.description} · ${t("lens.photo")} ${index + 1}`} className="h-24 w-24 rounded-md border bg-surface-2 object-contain sm:h-32 sm:w-32" />
            : <div key={path} className="grid h-24 w-24 place-items-center rounded-md bg-surface-2 sm:h-32 sm:w-32">{photoUrls.isPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}</div>;
        })}
      </div>
      {photoUrls.isError && <Button size="sm" variant="outline" onClick={() => photoUrls.refetch()}>{t("lens.photo")} · {t("lens.upload")}</Button>}
    </div>
  ) : null;

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

  // Every distinct product becomes an editable item; quantities and confirmation remain buyer-owned.
  useEffect(() => {
    if (!scan || scan === scanId || !cats.length) return;
    setScanId(scan);
    supabase.from("material_scans").select("id,result,note,photo_paths").eq("id", scan).maybeSingle().then(({ data }) => {
      const r = data?.result as (LensResult & { products?: LensProduct[]; chosen_suppliers?: string[] }) | undefined;
      if (!r) return;
      const products = lensProducts(r).filter((p) => p.rfq_item_draft);
      if (!products.length) return;
      setItems(products.map((p) => {
        const d = p.rfq_item_draft;
        const cat = cats.find((c) => c.slug === d?.category_slug);
        return { ...blankItem(), ...lensItemPhotos(p, data?.photo_paths ?? []), category_id: cat?.id ?? "", description: d?.description ?? p.item_name,
          specs: d?.specs ?? {}, unit: d?.unit || cat?.default_unit || "", standard: p.standards_to_ask_for[0] ?? "", quantity: 0, confidence: p.confidence, confirmed: false };
      }));
      setPreferred(r.chosen_suppliers ?? []);
      if (!title) setTitle(products.map((p) => p.item_name).join(" · "));
      if (data?.note && !description) setDescription(data.note);
      if (!projectType) setProjectType("renovation");
      setStep(0);
      toast.info(t("lens.prefilled"));
    });
  }, [scan, cats.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const canNext = [!!projectType && !!title.trim() && itemsValid, true][step];
  const slugs = Array.from(new Set(items.map((i) => catById.get(i.category_id)?.slug).filter((x): x is string => !!x)));
  const city = delivery.city || account?.company?.city || "";
  const suppliers = useQuery({
    queryKey: ["rfq-preview-suppliers", slugs.join(","), city],
    enabled: step === 1 && slugs.length > 0,
    queryFn: async () => {
      const res = await Promise.all(slugs.map((sl) => supabase.rpc("lens_suppliers", { _category_slug: sl, _city: city })));
      const m = new Map<string, { id: string; name: string; city: string | null; trust: number | null; lead: number | null; inRegion: boolean; score: number }>();
      for (const r of res) for (const x of r.data ?? []) {
        const prev = m.get(x.company_id);
        if (!prev || (x.match_score ?? 0) > prev.score) m.set(x.company_id, { id: x.company_id, name: x.name, city: x.city, trust: x.trust_score, lead: x.lead_time_days, inRegion: !!x.in_region, score: x.match_score ?? 0 });
      }
      return Array.from(m.values()).sort((a, b) => b.score - a.score);
    },
  });
  const [picked, setPicked] = useState<string[] | null>(null);
  const list = suppliers.data ?? [];
  const chosen = picked ?? (preferred.length ? preferred.filter((id) => list.some((x) => x.id === id)) : list.map((x) => x.id));
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  async function save(submit: boolean) {
    if (!account?.company || !projectType) return;
    setSaving(true);
    const kit = refs.data?.kits.find((k) => k.id === kitId);
    const { data: rfq, error } = await supabase.from("rfqs").insert({
      buyer_company_id: account.company.id, project_type: projectType, title: title.trim(), description: description.trim() || null,
      delivery_city: city.trim(), delivery_address: delivery.address.trim() || null,
      unloading: delivery.unloading, delivery_window: delivery.window, site_access_notes: delivery.access.trim() || null,
      delivery_date_requested: delivery.date || null, delivery_week: delivery.date ? isoWeek(delivery.date) : null,
      status: "draft", source: scanId ? "material_lens" : fromAi ? "snap_source" : kit ? "kit" : "manual",
      preferred_supplier_ids: submit && list.length ? chosen : preferred, material_scan_id: scanId, ai_upload_urls: fromAi ? uploadPaths : [],
    }).select("id,rfq_number").single();
    if (error || !rfq) { setSaving(false); toast.error(error?.message ?? "Error"); return; }
    const { error: e2 } = await supabase.from("rfq_items").insert(items.map((i, n) => ({
      rfq_id: rfq.id, category_id: i.category_id, description: i.description.trim(), specs: i.specs, quantity: i.quantity,
      unit: i.unit || catById.get(i.category_id)?.default_unit || null, standard: i.standard || null, waste_pct: i.waste_pct, sort_order: n + 1, buyer_confirmed: i.confirmed, ai_confidence: i.confidence,
    })));
    if (e2) { setSaving(false); toast.error(e2.message); return; }
    if (delivery.contact.trim() || delivery.phone.trim()) {
      const { error: ec } = await supabase.from("rfq_site_contacts").insert({ rfq_id: rfq.id, name: delivery.contact.trim() || null, phone: delivery.phone.trim() || null });
      if (ec) { setSaving(false); toast.error(ec.message); return; }
    }
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t("rfq.itemsHint")}</p>
            <LensButton variant="outline" label />
          </div>
          {preferred.length > 0 && <p className="rounded-md bg-primary/10 p-2 text-sm text-primary">{t("lens.preferred").replace("{n}", String(preferred.length))}</p>}
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
                {renderItemPhotos(it)}
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

        {step === 1 && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t("rfq.title")}</dt><dd className="font-medium">{title}</dd></div>
              <div><dt className="text-muted-foreground">{t("rfq.step.project")}</dt><dd>{projectType && t(`project.${projectType}` as TKey)}</dd></div>
            </dl>
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">{t("rfq.category")}</th><th>{t("rfq.itemDescription")}</th><th className="text-right">{t("rfq.quantity")}</th></tr></thead>
              <tbody>{items.map((it, i) => (
                <tr key={i} className="border-t align-top"><td className="py-2">{catById.get(it.category_id)?.name_en}</td>
                  <td className="space-y-2 p-2">{renderItemPhotos(it)}<p>{it.description}</p><div className="text-xs text-muted-foreground">{specsSummary(it.specs)}</div></td>
                  <td className="text-right tabular-nums">{it.quantity} {it.unit}</td></tr>))}
              </tbody>
            </table></div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-semibold">{t("rfq.potential")}</h3>
                {list.length > 0 && <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPicked(list.map((x) => x.id))}>{t("rfq.selectAll")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked([])}>{t("rfq.selectNone")}</Button>
                </div>}
              </div>
              {suppliers.isLoading ? <p className="text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />…</p>
                : list.length === 0 ? <p className="text-muted-foreground">{t("rfq.noPotential")}</p>
                : <ul className="grid gap-2 sm:grid-cols-2">{list.map((x) => (
                  <li key={x.id}><label className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3", chosen.includes(x.id) && "border-primary bg-primary/5")}>
                    <Checkbox checked={chosen.includes(x.id)} onCheckedChange={() => toggle(x.id)} aria-label={x.name} />
                    <span className="min-w-0 flex-1"><span className="block font-medium">{x.name}</span>
                      <span className="block text-xs text-muted-foreground">{x.city ?? ""}{x.trust != null && ` · Trust ${x.trust}`}{x.lead != null && ` · ${x.lead} d`}{!x.inRegion && ` · ${t("lens.outRegion")}`}</span></span>
                  </label></li>))}</ul>}
              {list.length > 0 && <p className="text-xs text-muted-foreground">{t("rfq.sendingTo").replace("{n}", String(chosen.length))}</p>}
            </div>
            <MatchingPools categoryIds={items.map((i) => i.category_id).filter(Boolean)} />
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>{t("rfq.back")}</Button>
        {step < 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>{t("rfq.next")}</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>{t("rfq.saveDraft")}</Button>
            <Button onClick={() => save(true)} disabled={saving || (list.length > 0 && chosen.length === 0)}>{t("rfq.submit")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
