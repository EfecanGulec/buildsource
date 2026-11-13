import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PoolStatus } from "@/components/pool/pool-card";
import { TierBar } from "@/components/pool/tier-bar";
import { TrustBadge, type Breakdown } from "@/components/trust-badge";
import { SmartIdDialog } from "@/components/smart-id-dialog";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { timeLeft, unitPrice, type Tier } from "@/lib/pool";
import { POOL_COLS, withTotals } from "@/lib/pool-data";

export const Route = createFileRoute("/_authenticated/app/group-buy/$poolId")({
  head: () => ({ meta: [{ title: "Group Buy pool — BuildSource LT" }] }),
  component: PoolPage,
});

function PoolPage() {
  const { poolId } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [qty, setQty] = useState("");
  const [ifFails, setIfFails] = useState("order_alone");
  const [signing, setSigning] = useState(false);
  const q = useQuery({
    queryKey: ["pool", poolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_buy_pools").select(POOL_COLS).eq("id", poolId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [pools, { data: me }, { data: trust }] = await Promise.all([
        withTotals([data]),
        supabase.from("pool_members").select("*").eq("pool_id", poolId).maybeSingle(),
        supabase.from("trust_scores").select("score,breakdown").eq("company_id", data.supplier_company_id).maybeSingle(),
      ]);
      return { pool: pools[0]!, me, trust };
    },
  });
  if (q.isLoading) return <div className="h-64 max-w-3xl animate-pulse rounded-lg bg-muted" />;
  if (!q.data) return <p className="text-muted-foreground">{t("rfq.notFound")}</p>;
  const { pool: p, me, trust } = q.data;
  const tiers = (p.tiers as Tier[]) ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ["pool", poolId] }); qc.invalidateQueries({ queryKey: ["pools"] }); };
  const active = me && (me.status === "joined" || me.status === "confirmed");

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    const { error } = await fn();
    if (error) { toast.error(error.message); return; }
    if (ok) toast.success(ok);
    refresh();
  }
  const specs = Object.entries((p.product_specs ?? {}) as Record<string, unknown>);
  const certs = (Array.isArray(p.certificates) ? p.certificates : []) as string[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-display text-2xl font-semibold">{p.product_name}</h1>
          <p className="text-sm text-muted-foreground">{p.companies?.name} · {t("pool.region")}: {p.region ?? "—"} · {t("pool.delivery")}: {p.delivery_week ?? "—"}</p></div>
        <div className="flex items-center gap-2">{trust && <TrustBadge score={trust.score} breakdown={trust.breakdown as Breakdown} />}<PoolStatus status={p.status} /></div>
      </div>
      {p.images?.length > 0 && <div className="flex gap-2 overflow-x-auto">{p.images.map((src) => <img key={src} src={src} alt={p.product_name} className="h-40 rounded-md object-cover" />)}</div>}
      <div className="rounded-lg border bg-card p-6 space-y-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span>{t("pool.maxPrice")} <strong>{eur(Number(p.base_price))}</strong> / {p.unit}</span>
          <span>{t("pool.minQty")}: {p.min_qty} {p.unit}</span>
          <span>{p.totals.members} {t("pool.members")} · {t("pool.endsIn")} {timeLeft(p.deadline)}</span>
        </div>
        <TierBar tiers={tiers} qty={p.totals.total_qty} unit={p.unit} />
        <div><p className="mb-1 font-medium">{t("pool.tiers")}</p>
          <ul className="grid gap-1 sm:grid-cols-3">{tiers.map((x) => (
            <li key={x.min_qty} className="rounded-md border p-2">{x.min_qty}+ {p.unit}: −{x.discount_pct}% → {eur(unitPrice(Number(p.base_price), x.discount_pct))}</li>))}</ul></div>
        {specs.length > 0 && <div><p className="mb-1 font-medium">{t("pool.specs")}</p>
          <dl className="grid gap-1 sm:grid-cols-2">{specs.map(([k, v]) => <div key={k}><dt className="inline text-muted-foreground">{k.replace(/_/g, " ")}: </dt><dd className="inline">{String(v)}</dd></div>)}</dl></div>}
        {certs.length > 0 && <p><span className="font-medium">{t("pool.certs")}:</span> {certs.join(", ")}</p>}
      </div>

      {p.status === "open" && (
        <div className="rounded-lg border bg-card p-6 space-y-4 text-sm">
          {active && <p className="font-medium text-primary">{t("pool.joined")}: {Number(me.quantity)} {p.unit}</p>}
          <label className="block max-w-xs space-y-1"><span>{t("pool.yourQty")} ({p.unit})</span>
            <Input type="number" min={1} value={qty} placeholder={active ? String(me.quantity) : ""} onChange={(e) => setQty(e.target.value)} /></label>
          <div className="space-y-2"><span>{t("pool.ifFails")}</span>
            <RadioGroup value={ifFails} onValueChange={setIfFails}>
              <div className="flex items-center gap-2"><RadioGroupItem value="order_alone" id="oa" /><Label htmlFor="oa">{t("pool.orderAlone")}</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="cancel" id="cx" /><Label htmlFor="cx">{t("pool.cancel")}</Label></div>
            </RadioGroup></div>
          <div className="flex gap-2">
            <Button disabled={!(Number(qty || me?.quantity) > 0)} onClick={() => run(() => supabase.rpc("pool_join", { _pool: p.id, _qty: Number(qty || me?.quantity), _if_fails: ifFails }), t("pool.joined"))}>
              {active ? t("pool.update") : t("pool.join")}</Button>
            {active && <Button variant="ghost" onClick={() => run(() => supabase.rpc("pool_leave", { _pool: p.id }))}>{t("pool.leave")}</Button>}
          </div>
        </div>)}

      {p.status === "confirming" && me?.status === "joined" && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-6 space-y-3 text-sm">
          <p className="font-display text-lg font-semibold">{t("pool.confirmTitle")} · {timeLeft(p.confirm_until)}</p>
          <p>{t("pool.confirmBody").replace("{p}", eur(Number(p.final_unit_price))).replace("{u}", p.unit).replace("{t}", eur(Number(me.quantity) * Number(p.final_unit_price)))}</p>
          <Button onClick={() => setSigning(true)}>{t("pool.confirm")}</Button>
        </div>)}
      {me?.status === "confirmed" && me.order_id && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
          {t("pool.confirmed")} · <Link className="text-primary underline" to="/app/orders/$orderId" params={{ orderId: me.order_id }}>{t("pool.openOrder")}</Link></div>)}
      {p.status === "cancelled" && <div className="rounded-md bg-muted p-4 text-sm">{t("pool.cancelled")}
        {me?.rfq_id && <> · <Link className="text-primary underline" to="/app/rfqs/$rfqId" params={{ rfqId: me.rfq_id }}>{t("pool.myRfq")}</Link></>}</div>}
      {me?.status === "no_response" && <p className="rounded-md bg-muted p-4 text-sm">{t("pool.noResponse")}</p>}
      <SmartIdDialog open={signing} onOpenChange={setSigning} title={t("pool.confirm")}
        onConfirmed={(code) => run(() => supabase.rpc("pool_confirm", { _pool: p.id, _code: code }), t("pool.confirmed"))} />
    </div>
  );
}
