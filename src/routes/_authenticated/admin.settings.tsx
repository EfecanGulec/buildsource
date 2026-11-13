import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { eur } from "@/components/rfq/quote-thread";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Platform settings — BuildSource LT admin" }, { name: "description", content: "Admin platform settings such as the payment decision deadline." }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform-settings"], queryFn: async () => {
    const { data, error } = await supabase.from("platform_settings").select("value").eq("key", "payment_deadline_minutes").maybeSingle();
    if (error) throw error;
    return Number(data?.value ?? 60);
  } });
  const [min, setMin] = useState("60");
  useEffect(() => { if (q.data) setMin(String(q.data)); }, [q.data]);
  async function save() {
    const { error } = await supabase.rpc("admin_set_payment_deadline", { _minutes: Number(min) });
    if (error) { toast.error(error.message); return; }
    toast.success(t("ps.saved")); qc.invalidateQueries({ queryKey: ["platform-settings"] });
  }
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.platformSettings")}</h1>
      <Card>
        <CardHeader><CardTitle>{t("ps.payTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("ps.payHelp")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label htmlFor="pd">{t("ps.minutes")}</Label>
              <Input id="pd" type="number" min={5} max={10080} value={min} onChange={(e) => setMin(e.target.value)} className="w-36" /></div>
            <Button onClick={save} disabled={!min || Number(min) === q.data}>{t("cd.save")}</Button>
          </div>
          {q.data != null && <p className="text-sm">{t("ps.current")}: <strong>{q.data} min</strong></p>}
        </CardContent>
      </Card>
      <CategoryCommissions />
      <OrderCommissions />
    </div>
  );
}

type Cat = { id: string; name_en: string; parent_id: string | null; commission_group: string; commission_rate: number | null; sort_order: number };

function CategoryCommissions() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-cat-commission"], queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("id,name_en,parent_id,commission_group,commission_rate,sort_order").order("sort_order");
    if (error) throw error;
    return data as Cat[];
  } });
  const [edit, setEdit] = useState<Record<string, string>>({});
  async function save(c: Cat) {
    const raw = (edit[c.id] ?? "").trim();
    const rate = raw === "" ? null : Number(raw) / 100;
    if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 0.3)) { toast.error(t("cm.range")); return; }
    const { error } = await supabase.rpc("admin_set_category_commission", { _category: c.id, _rate: rate as number });
    if (error) { toast.error(error.message); return; }
    toast.success(t("ps.saved")); qc.invalidateQueries({ queryKey: ["admin-cat-commission"] });
  }
  const cats = q.data ?? [];
  const parents = cats.filter((c) => !c.parent_id);
  const rows = parents.flatMap((p) => [p, ...cats.filter((c) => c.parent_id === p.id)]);
  const shown = (c: Cat) => edit[c.id] ?? (c.commission_rate == null ? "" : String(+(Number(c.commission_rate) * 100).toFixed(2)));
  const parentRate = (c: Cat) => cats.find((p) => p.id === c.parent_id)?.commission_rate;
  return (
    <Card>
      <CardHeader><CardTitle>{t("cm.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("cm.help")}</p>
        {q.isPending || q.isError ? <QueryState isLoading={q.isPending} error={q.error} onRetry={() => q.refetch()} /> : (
          <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-3 [&>th]:py-2"><th>{t("cm.category")}</th><th>{t("cm.applies")}</th><th>{t("cm.rate")}</th><th /></tr></thead>
            <tbody>{rows.map((c) => {
              const inherited = c.commission_rate == null && c.parent_id && parentRate(c) != null;
              return (
              <tr key={c.id} className="border-t [&>td]:px-3 [&>td]:py-2">
                <td className={c.parent_id ? "pl-8" : "font-semibold"}>{c.parent_id ? "↳ " : ""}{c.name_en}</td>
                <td className="text-muted-foreground">{c.commission_rate != null ? t("cm.custom") : inherited ? `${t("cm.fromParent")} (${(Number(parentRate(c)) * 100).toFixed(1)}%)` : t("cm.standard")}</td>
                <td><div className="flex items-center gap-1"><Input aria-label={`${t("cm.rate")} ${c.name_en}`} type="number" min={0} max={30} step={0.1} placeholder="—" value={shown(c)} onChange={(e) => setEdit({ ...edit, [c.id]: e.target.value })} className="w-24" /><span>%</span></div></td>
                <td className="text-right"><Button size="sm" variant="outline" disabled={edit[c.id] === undefined} onClick={() => save(c)}>{t("cd.save")}</Button></td>
              </tr>); })}</tbody>
          </table></div>)}
      </CardContent>
    </Card>
  );
}

function OrderCommissions() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["admin-order-commissions"], queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_order_commissions");
    if (error) throw error;
    return data;
  } });
  const rows = q.data ?? [];
  const total = rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.commission_amount), 0);
  return (
    <Card>
      <CardHeader><CardTitle>{t("cm.orders")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {q.isPending || q.isError ? <QueryState isLoading={q.isPending} error={q.error} onRetry={() => q.refetch()} /> : (<>
          <p className="text-sm">{t("cm.earned")}: <strong className="tabular-nums">{eur(total)}</strong></p>
          <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-3 [&>th]:py-2"><th>{t("ord.number")}</th><th>{t("cm.parties")}</th><th>{t("cm.category")}</th><th className="text-right">{t("rfq.total")}</th><th className="text-right">{t("cm.rate")}</th><th className="text-right">{t("earn.commission")}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.order_id} className={`border-t [&>td]:px-3 [&>td]:py-2 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
                <td className="font-mono">{r.order_number}<div className="font-sans text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.status}</div></td>
                <td>{r.buyer_name}<div className="text-xs text-muted-foreground">→ {r.supplier_name}</div></td>
                <td>{r.categories ?? "—"}</td>
                <td className="text-right tabular-nums">{eur(Number(r.total))}</td>
                <td className="text-right tabular-nums">{(Number(r.commission_rate) * 100).toFixed(1)}%</td>
                <td className="text-right tabular-nums font-medium">{eur(Number(r.commission_amount))}</td>
              </tr>))}</tbody>
          </table></div>
        </>)}
      </CardContent>
    </Card>
  );
}
