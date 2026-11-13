import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/rfq/status-badge";
import { eur } from "@/components/rfq/quote-thread";
import { TrustBadge, type Breakdown } from "@/components/trust-badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { compareLabels, nextActions } from "@/lib/quote";

type Search = { rfq?: string };
export const Route = createFileRoute("/_authenticated/app/compare")({
  validateSearch: (s: Record<string, unknown>): Search => (typeof s.rfq === "string" ? { rfq: s.rfq } : {}),
  head: () => ({ meta: [{ title: "Compare quotes — BuildSource LT" }] }),
  component: Compare,
});

type Line = { rfq_item_id: string; unit_price: number; line_total: number };

function Compare() {
  const { t } = useI18n();
  const { rfq: rfqId } = Route.useSearch();
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ["compare-rfqs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rfqs").select("id,rfq_number,title,quotes(count)").order("created_at", { ascending: false });
      if (error) throw error;
      return data.filter((r) => (r.quotes[0]?.count ?? 0) > 0);
    },
  });
  const selected = rfqId ?? list.data?.[0]?.id;
  const q = useQuery({
    queryKey: ["compare", selected], enabled: !!selected,
    queryFn: async () => {
      await supabase.rpc("expire_stale_quotes");
      const { data: rfq, error } = await supabase.from("rfqs")
        .select("id,rfq_number,title,status,delivery_city,negotiation_round_limit,rfq_items(id,description,quantity,unit,category_id,sort_order),quotes(*,companies(name,city),quote_versions(*)),agreements(id,status)")
        .eq("id", selected!).maybeSingle();
      if (error) throw error;
      if (!rfq) return null;
      const ids = rfq.quotes.map((x) => x.supplier_company_id);
      const cats = [...new Set(rfq.rfq_items.map((i) => i.category_id).filter(Boolean))] as string[];
      const [{ data: scores }, { data: idx }] = await Promise.all([
        ids.length ? supabase.from("trust_scores").select("*").in("company_id", ids) : Promise.resolve({ data: [] }),
        cats.length ? supabase.from("price_index").select("*").in("category_id", cats).gte("sample_count", 5) : Promise.resolve({ data: [] }),
      ]);
      const market = new Map<string, number>();
      for (const c of cats) {
        const rows = (idx ?? []).filter((r) => r.category_id === c);
        if (rows.length) market.set(c, rows.reduce((s, r) => s + Number(r.avg_unit_price), 0) / rows.length);
      }
      return { rfq, scores: new Map((scores ?? []).map((s) => [s.company_id, s])), market };
    },
  });

  async function accept(quoteId: string) {
    const { data, error } = await supabase.rpc("buyer_accept_quote", { _quote: quoteId });
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/app/agreements/$agreementId", params: { agreementId: data } });
  }

  const d = q.data;
  const items = d ? [...d.rfq.rfq_items].sort((a, b) => a.sort_order - b.sort_order) : [];
  const cols = d ? d.rfq.quotes.map((qu) => {
    const vs = [...qu.quote_versions].sort((a, b) => b.version - a.version);
    const latest = vs[0]; const supplierV = vs.find((v) => v.party === "supplier");
    return { qu, latest, supplierV, lines: new Map(((supplierV?.lines as Line[]) ?? []).map((l) => [l.rfq_item_id, l])) };
  }) : [];
  const open = cols.filter((c) => c.supplierV && (c.qu.status === "sent" || c.qu.status === "negotiating"));
  const labels = compareLabels(open.map((c) => ({ id: c.qu.id, total: Number(c.supplierV!.total), leadDays: c.supplierV!.lead_time_days })));
  const pending = d?.rfq.agreements.find((a) => a.status !== "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">{t("nav.compare")}</h1>
        {list.data && list.data.length > 0 && (
          <Select value={selected} onValueChange={(v) => navigate({ to: "/app/compare", search: { rfq: v } })}>
            <SelectTrigger className="w-80" aria-label="RFQ"><SelectValue /></SelectTrigger>
            <SelectContent>{list.data.map((r) => <SelectItem key={r.id} value={r.id}>{r.rfq_number} · {r.title}</SelectItem>)}</SelectContent>
          </Select>)}
      </div>
      {list.data?.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("compare.empty")}</p>}
      {pending && <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">{t("compare.hasAgreement")} <Link className="font-medium text-primary underline" to="/app/agreements/$agreementId" params={{ agreementId: pending.id }}>{t("compare.openAgreement")}</Link></p>}
      {d && cols.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b align-top [&>th]:p-4 [&>th]:text-left">
              <th className="w-64 text-muted-foreground">{d.rfq.rfq_number}</th>
              {cols.map((c) => { const s = d.scores.get(c.qu.supplier_company_id); return (
                <th key={c.qu.id} className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {labels.best === c.qu.id && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{t("compare.best")}</span>}
                    {labels.fastest === c.qu.id && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold">{t("compare.fastest")}</span>}
                  </div>
                  <div className="font-display text-base">{c.qu.companies?.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{c.qu.companies?.city}</div>
                  {s && <TrustBadge score={s.score} breakdown={s.breakdown as Breakdown} dataDate={s.public_data_date} />}
                  <div><StatusBadge kind="quote" status={c.qu.status} /></div>
                </th>); })}
            </tr></thead>
            <tbody>
              {items.map((it) => { const m = it.category_id ? d.market.get(it.category_id) : undefined; return (
                <tr key={it.id} className="border-b [&>td]:px-4 [&>td]:py-2">
                  <td>{it.description}<div className="text-xs text-muted-foreground">{Number(it.quantity)} {it.unit}{m != null && ` · ${t("compare.market")} ${eur(m)}`}</div></td>
                  {cols.map((c) => { const l = c.lines.get(it.id); return (
                    <td key={c.qu.id} className="tabular-nums">{l ? <>{eur(Number(l.unit_price))}<div className="text-xs text-muted-foreground">{eur(Number(l.line_total))}</div></> : "—"}</td>); })}
                </tr>); })}
              <Row label={t("quote.deliveryCost")} cols={cols} get={(c) => c.supplierV ? eur(Number(c.supplierV.delivery_cost)) : "—"} />
              <Row label={t("rfq.leadTime")} cols={cols} get={(c) => c.supplierV?.lead_time_days != null ? `${c.supplierV.lead_time_days} ${t("rfq.days")}` : "—"} />
              <Row label={t("rfq.date")} cols={cols} get={(c) => c.supplierV?.delivery_date ?? "—"} />
              <Row label={t("quote.terms")} cols={cols} get={(c) => c.supplierV?.payment_terms ?? "—"} />
              <Row label={t("quote.validUntil")} cols={cols} get={(c) => c.supplierV?.valid_until ?? "—"} />
              <tr className="border-b [&>td]:px-4 [&>td]:py-3"><td className="font-semibold">{t("rfq.total")}</td>
                {cols.map((c) => <td key={c.qu.id} className="font-display text-lg font-semibold tabular-nums">{c.supplierV ? eur(Number(c.supplierV.total)) : "—"}
                  {c.latest?.party === "buyer" && <div className="text-xs font-normal text-muted-foreground">{t("quote.waitSupplier")}</div>}</td>)}</tr>
              <tr className="[&>td]:px-4 [&>td]:py-3"><td />
                {cols.map((c) => { const a = nextActions({ status: c.qu.status, lastParty: c.latest?.party ?? null, roundCount: c.qu.round_count, roundLimit: d.rfq.negotiation_round_limit }); return (
                  <td key={c.qu.id} className="space-y-2">
                    {a.buyerAccept && !pending && <Button className="w-full" onClick={() => accept(c.qu.id)}>{t("compare.accept")}</Button>}
                    <Button asChild variant="outline" className="w-full"><Link to="/app/rfqs/$rfqId" params={{ rfqId: d.rfq.id }}>{t("compare.negotiate")}</Link></Button>
                  </td>); })}</tr>
            </tbody>
          </table>
        </div>)}
    </div>
  );
}

function Row<T extends { qu: { id: string } }>({ label, cols, get }: { label: string; cols: T[]; get: (c: T) => string }) {
  return <tr className="border-b [&>td]:px-4 [&>td]:py-2"><td className="text-muted-foreground">{label}</td>{cols.map((c) => <td key={c.qu.id}>{get(c)}</td>)}</tr>;
}
