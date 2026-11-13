import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PoolTable } from "@/components/pool/pool-table";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { sortTiers, validTiers, type Tier } from "@/lib/pool";
import { POOL_COLS, withTotals } from "@/lib/pool-data";

export const Route = createFileRoute("/_authenticated/supplier/pools")({
  head: () => ({ meta: [{ title: "My Group Buy pools — BuildSource LT" }] }),
  component: SupplierPools,
});

function SupplierPools() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const account = useAccount();
  const companyId = account.data?.company?.id;
  const q = useQuery({ queryKey: ["supplier-pools", companyId], enabled: !!companyId, queryFn: async () => {
    const { data, error } = await supabase.from("group_buy_pools").select(POOL_COLS).eq("supplier_company_id", companyId!).order("created_at", { ascending: false });
    if (error) throw error;
    return withTotals(data);
  } });
  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("id,name_en,default_unit").order("sort_order")).data ?? [] });
  const [f, setF] = useState({ name: "", category: "", unit: "pcs", base: "", minQty: "", region: "", deadline: "", image: "" });
  const [tiers, setTiers] = useState<Tier[]>([{ min_qty: 100, discount_pct: 5 }, { min_qty: 200, discount_pct: 8 }]);
  const ok = f.name.trim() && Number(f.base) > 0 && f.deadline && validTiers(tiers);

  async function create() {
    const s = sortTiers(tiers);
    const { error } = await supabase.from("group_buy_pools").insert({
      supplier_company_id: companyId!, product_name: f.name.trim(), category_id: f.category || null, unit: f.unit || "pcs",
      base_price: Number(f.base), tiers: s, min_qty: Number(f.minQty) || s[0]!.min_qty, region: f.region || null,
      deadline: new Date(f.deadline).toISOString(), images: f.image ? [f.image] : [], status: "open",
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("pool.created"));
    setF({ name: "", category: "", unit: "pcs", base: "", minQty: "", region: "", deadline: "", image: "" });
    qc.invalidateQueries({ queryKey: ["supplier-pools"] });
  }
  const close = async (id: string) => {
    const { error } = await supabase.rpc("close_pool_now", { _pool: id });
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["supplier-pools"] });
  };
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="space-y-1 text-sm"><span>{label}</span><Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.pools")}</h1>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-display font-semibold">{t("pool.new")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("name", t("pool.product"))}
          <label className="space-y-1 text-sm"><span>{t("pool.category")}</span>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v, unit: cats.data?.find((c) => c.id === v)?.default_unit ?? f.unit })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}</SelectContent></Select></label>
          {field("base", t("pool.base"), "number")}
          {field("unit", t("pool.unit"))}
          {field("minQty", t("pool.minQty"), "number")}
          {field("region", t("pool.region"))}
          {field("deadline", t("pool.deadline"), "datetime-local")}
          {field("image", t("pool.imageUrl"))}
        </div>
        <div className="space-y-2 text-sm"><p className="font-medium">{t("pool.tiers")}</p>
          {tiers.map((x, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="space-y-1"><span className="text-xs text-muted-foreground">{t("pool.tierQty")}</span>
                <Input type="number" value={x.min_qty} onChange={(e) => setTiers(tiers.map((y, j) => j === i ? { ...y, min_qty: Number(e.target.value) } : y))} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">{t("pool.tierPct")}</span>
                <Input type="number" value={x.discount_pct} onChange={(e) => setTiers(tiers.map((y, j) => j === i ? { ...y, discount_pct: Number(e.target.value) } : y))} /></label>
              <Button variant="ghost" size="icon" aria-label="Remove tier" disabled={tiers.length === 1} onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>))}
          <Button variant="outline" size="sm" onClick={() => { const last = tiers.at(-1); setTiers([...tiers, { min_qty: (last?.min_qty ?? 0) + 100, discount_pct: (last?.discount_pct ?? 0) + 3 }]); }}><Plus className="h-4 w-4" />{t("pool.addTier")}</Button>
          {!validTiers(tiers) && <p className="text-destructive">{t("pool.badTiers")}</p>}
        </div>
        <Button disabled={!ok} onClick={create}>{t("pool.create")}</Button>
      </div>
      {q.data && <PoolTable rows={q.data} onClose={close} />}
    </div>
  );
}
