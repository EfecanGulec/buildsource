import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationLevelBadge } from "@/components/catalog/level-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import { columnsOf, FIELDS, needsCheck, parseFeed, suggestMapping, TEMPLATE_CSV, type Mapping } from "@/lib/catalog";
import { importFeed } from "@/lib/catalog.functions";
import { eur } from "@/components/rfq/quote-thread";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/supplier/catalogue")({
  head: () => ({ meta: [
    { title: "Catalogue & feeds — BuildSource LT" },
    { name: "description", content: "Connect supplier product feeds, spreadsheets and shops to BuildSource LT." },
  ] }),
  component: Catalogue,
});

const TYPES = ["spreadsheet", "csv", "xml", "woocommerce", "shopify", "prestashop"] as const;
const SHOP = new Set(["woocommerce", "shopify", "prestashop", "erp"]);
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

function Catalogue() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const cid = account?.company?.id;
  const run = useServerFn(importFeed);

  const feeds = useQuery({ queryKey: ["feeds", cid], enabled: !!cid,
    queryFn: async () => (await supabase.from("product_feeds").select("*,feed_runs(*)").order("created_at")).data ?? [] });
  const products = useQuery({ queryKey: ["products", cid], enabled: !!cid,
    queryFn: async () => (await supabase.from("products").select("*,categories(name_en)").eq("is_active", true).order("name").limit(500)).data ?? [] });
  const cats = useQuery({ queryKey: ["leaf-cats"],
    queryFn: async () => (await supabase.from("categories").select("id,name_en").not("parent_id", "is", null).order("sort_order")).data ?? [] });

  const [form, setForm] = useState({ type: "xml", url: "", secret: "", schedule: "daily" });
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [tab, setTab] = useState<"check" | "all">("check");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["feeds"] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["integration-level"] }); };

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("supplier_save_feed", { _id: null as unknown as string, _type: form.type, _url: form.url,
        _secret_ref: form.secret || (null as unknown as string), _mapping: {}, _schedule: form.schedule });
      if (error) throw error; return data as string;
    },
    onSuccess: (id) => { setActive(id); setContent(null); setColumns([]); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function load(text: string, type: string) {
    const rows = parseFeed(text, type);
    const cols = columnsOf(rows);
    setContent(text); setColumns(cols); setRowCount(rows.length); setMapping(suggestMapping(cols));
  }
  async function loadSample(type: string) { load(await (await fetch("/samples/demo-feed.xml")).text(), type === "csv" || type === "spreadsheet" ? "xml" : type); }

  const doImport = useMutation({
    mutationFn: async (feed: { id: string; type: string; field_mapping: Json }) => {
      let m = (columns.length ? mapping : feed.field_mapping) as Mapping;
      let body = content ?? undefined;
      if (!body && SHOP.has(feed.type)) {
        const text = await (await fetch("/samples/demo-feed.xml")).text();
        body = text; if (!Object.keys(m).length) m = suggestMapping(columnsOf(parseFeed(text, "xml")));
      }
      const { error } = await supabase.rpc("supplier_save_feed", { _id: feed.id, _type: feed.type, _url: (feeds.data?.find((f) => f.id === feed.id)?.url ?? ""),
        _secret_ref: feeds.data?.find((f) => f.id === feed.id)?.credentials_secret_ref ?? (null as unknown as string), _mapping: m as Json,
        _schedule: feeds.data?.find((f) => f.id === feed.id)?.schedule ?? "daily" });
      if (error) throw error;
      return run({ data: { feedId: feed.id, content: body } });
    },
    onSuccess: (r) => {
      toast.success(t("cat.imported").replace("{a}", String(r.added)).replace("{u}", String(r.updated)).replace("{d}", String(r.deactivated)).replace("{f}", String(r.flagged)));
      if (r.mode === "demo") toast.info(t("cat.shopDemo"));
      setContent(null); setColumns([]); setActive(null); refresh(); setTab("check");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: async ({ id, cat }: { id: string; cat: string }) => {
      const { error } = await supabase.rpc("supplier_confirm_product", { _id: id, _category: cat }); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const list = products.data ?? [];
  const flagged = list.filter(needsCheck);
  const shown = tab === "check" ? flagged : list;
  const activeFeed = feeds.data?.find((f) => f.id === active);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t("cat.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("cat.sub")}</p>
        </div>
        {cid && <IntegrationLevelBadge companyId={cid} />}
      </div>

      <section className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-semibold">{t("cat.sources")}</h2>
          <Button variant="outline" size="sm" asChild>
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`} download="buildsource-catalogue-template.csv">{t("cat.template")}</a>
          </Button>
        </div>
        {(feeds.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("cat.noSources")}</p>}
        <ul className="divide-y">
          {(feeds.data ?? []).map((f) => {
            const runs = [...(f.feed_runs ?? [])].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 3);
            return (
              <li key={f.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium uppercase">{f.type}</span>
                    {f.url && <span className="ml-2 text-muted-foreground break-all">{f.url}</span>}
                    <p className="text-xs text-muted-foreground">{t("cat.lastRun")}: {f.last_run_at ? new Date(f.last_run_at).toLocaleString("en-GB") : t("cat.never")} · {f.products_count} {t("cat.products").toLowerCase()} · {f.schedule === "hourly" ? t("cat.hourly") : t("cat.daily")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setActive(f.id); setContent(null); setColumns([]); }}>{t("cat.mapping")}</Button>
                    <Button size="sm" disabled={doImport.isPending} onClick={() => doImport.mutate(f)}>{doImport.isPending ? t("cat.importing") : t("cat.runNow")}</Button>
                  </div>
                </div>
                {runs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t("cat.runs")}: {runs.map((r) => `${fmtDate(r.started_at)} +${r.added}/~${r.updated}/−${r.deactivated}`).join(" · ")}</p>}
              </li>
            );
          })}
        </ul>

        <div className="grid gap-3 rounded-md bg-muted p-3 sm:grid-cols-5">
          <label className="space-y-1 text-sm"><span>{t("cat.type")}</span>
            <select className={sel} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span>{t("cat.url")}</span>
            <Input value={form.url} placeholder="https://" onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <label className="space-y-1 text-sm"><span>{t("cat.schedule")}</span>
            <select className={sel} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}>
              <option value="daily">{t("cat.daily")}</option><option value="hourly">{t("cat.hourly")}</option></select></label>
          <div className="flex items-end"><Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>{t("cat.addSource")}</Button></div>
          {SHOP.has(form.type) && <label className="space-y-1 text-sm sm:col-span-5"><span>{t("cat.secret")}</span>
            <Input value={form.secret} placeholder="MYSHOP_API_KEY" onChange={(e) => setForm({ ...form, secret: e.target.value.toUpperCase() })} />
            <span className="text-xs text-muted-foreground">{t("cat.secretHelp")}</span></label>}
          <p className="text-xs text-muted-foreground sm:col-span-5">{t("cat.scheduleNote")}</p>
        </div>
      </section>

      {activeFeed && (
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="font-display font-semibold">{t("cat.mapping")} — <span className="uppercase">{activeFeed.type}</span></h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><label className="cursor-pointer">{t("cat.upload")}
              <input type="file" accept=".csv,.xml,.txt" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text(), activeFeed.type); }} /></label></Button>
            <Button variant="outline" size="sm" onClick={() => loadSample(activeFeed.type)}>{t("cat.sample")}</Button>
          </div>
          {columns.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{t("cat.mappingSub")} {t("cat.rows").replace("{n}", String(rowCount))}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIELDS.map((f) => (
                  <label key={f} className="space-y-1 text-sm"><span className="font-mono text-xs">{f}{(f === "name" || f === "external_id") && " *"}</span>
                    <select className={sel} value={mapping[f] ?? ""} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value || undefined })}>
                      <option value="">{t("cat.notUsed")}</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                ))}
              </div>
              <Button disabled={doImport.isPending || !mapping.name} onClick={() => doImport.mutate(activeFeed)}>{doImport.isPending ? t("cat.importing") : t("cat.import")}</Button>
            </>
          )}
        </section>
      )}

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === "check" ? "default" : "outline"} onClick={() => setTab("check")}>{t("cat.check")} ({flagged.length})</Button>
          <Button size="sm" variant={tab === "all" ? "default" : "outline"} onClick={() => setTab("all")}>{t("cat.products")} ({list.length})</Button>
        </div>
        {tab === "check" && flagged.length > 0 && <p className="text-sm text-muted-foreground">{t("cat.checkSub")}</p>}
        {shown.length === 0 ? <p className="text-sm text-muted-foreground">{t("cat.noProducts")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">{t("cat.products")}</th><th>{t("cat.price")}</th><th>{t("cat.stock")}</th><th>{t("cat.confidence")}</th><th className="w-64"></th></tr></thead>
              <tbody>{shown.slice(0, 200).map((p) => (
                <ProductRow key={p.id} p={p} cats={cats.data ?? []} check={tab === "check"} onConfirm={(cat) => confirm.mutate({ id: p.id, cat })} />
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type P = { id: string; name: string; external_id: string; list_price: number | null; currency: string; unit: string | null; stock_qty: number | null;
  mapping_confidence: number | null; mapping_confirmed: boolean; category_id: string | null; price_updated_at: string | null; categories: { name_en: string } | null };

function ProductRow({ p, cats, check, onConfirm }: { p: P; cats: { id: string; name_en: string }[]; check: boolean; onConfirm: (c: string) => void }) {
  const { t } = useI18n();
  const [cat, setCat] = useState(p.category_id ?? "");
  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-2"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.external_id}</p></td>
      <td className="tabular-nums">{p.list_price != null ? `${eur(Number(p.list_price))}${p.unit ? ` / ${p.unit}` : ""}` : "—"}
        <p className="text-xs text-muted-foreground">{t("cat.priceUpdated").replace("{d}", fmtDate(p.price_updated_at))}</p></td>
      <td className="tabular-nums">{p.stock_qty ?? "—"}</td>
      <td className="tabular-nums">{p.mapping_confirmed ? "✓" : p.mapping_confidence != null ? `${Math.round(Number(p.mapping_confidence) * 100)}%` : "—"}</td>
      <td>{check ? (
        <div className="flex gap-2"><select className={sel} aria-label={`Category for ${p.name}`} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}</select>
          <Button size="sm" disabled={!cat} onClick={() => onConfirm(cat)}>{t("cat.confirm")}</Button></div>
      ) : <span className="text-muted-foreground">{p.categories?.name_en ?? "—"}</span>}</td>
    </tr>
  );
}
