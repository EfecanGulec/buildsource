import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/rfq/status-badge";
import { specsSummary } from "@/components/rfq/spec-fields";
import { ChatPanel } from "@/components/rfq/chat-panel";
import { OfferForm, type Offer } from "@/components/rfq/offer-form";
import { QuoteThread, type ThreadVersion } from "@/components/rfq/quote-thread";
import { Textarea } from "@/components/ui/textarea";
import { nextActions } from "@/lib/quote";
import { useState } from "react";
import { TrustBadge, type Breakdown } from "@/components/trust-badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";

export const Route = createFileRoute("/_authenticated/app/rfqs/$rfqId")({
  head: () => ({ meta: [{ title: "RFQ — BuildSource LT" }] }),
  component: RfqDetail,
});

const eur = (n: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

function RfqDetail() {
  const { rfqId } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["rfqs", rfqId],
    queryFn: async () => {
      await supabase.rpc("expire_stale_quotes");
      const { data: rfq, error } = await supabase.from("rfqs")
        .select("*, rfq_items(*, categories(name_en)), rfq_recipients(*, companies(name,city)), quotes(*, quote_versions(*), companies(name))")
        .eq("id", rfqId).maybeSingle();
      if (error) throw error;
      if (!rfq) return null;
      const ids = rfq.rfq_recipients.map((r) => r.supplier_company_id);
      const { data: scores } = ids.length ? await supabase.from("trust_scores").select("*").in("company_id", ids) : { data: [] };
      return { rfq, scores: new Map((scores ?? []).map((s) => [s.company_id, s])) };
    },
  });
  if (q.isLoading) return <p className="text-muted-foreground">…</p>;
  if (!q.data) return <p className="text-muted-foreground">{t("rfq.notFound")}</p>;
  const { rfq, scores } = q.data;
  const items = [...rfq.rfq_items].sort((a, b) => a.sort_order - b.sort_order);
  const recipients = [...rfq.rfq_recipients].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const activity = [
    { at: rfq.created_at, text: t("rfq.act.created") },
    ...(rfq.submitted_at ? [{ at: rfq.submitted_at, text: t("rfq.act.submitted") }] : []),
    ...recipients.filter((r) => r.sent_at).map((r) => ({ at: r.sent_at!, text: `${t("rfq.act.sent")} ${r.companies?.name}` })),
    ...rfq.quotes.flatMap((qu) => qu.quote_versions.map((v) => ({ at: v.created_at,
      text: `${v.party === "buyer" ? t("rfq.act.counter") : t("rfq.act.offer")} v${v.version} · ${qu.companies?.name} · ${eur(Number(v.total))}` }))),
  ].sort((a, b) => b.at.localeCompare(a.at));

  async function submit() {
    const { error } = await supabase.from("rfqs").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", rfqId);
    if (error) { toast.error(error.message); return; }
    toast.success(t("rfq.submitted").replace("{n}", rfq.rfq_number));
    qc.invalidateQueries({ queryKey: ["rfqs"] });
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/app/rfqs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t("nav.rfqs")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{rfq.rfq_number}</p>
          <h1 className="font-display text-2xl font-semibold">{rfq.title}</h1>
          <p className="text-sm text-muted-foreground">{t(`project.${rfq.project_type}` as TKey)} · {rfq.delivery_city} · {rfq.delivery_week}</p>
        </div>
        <div className="flex items-center gap-3"><StatusBadge status={rfq.status} />
          {rfq.status === "draft" && <Button onClick={submit}>{t("rfq.submit")}</Button>}</div>
      </div>
      <Tabs defaultValue={recipients.length ? "suppliers" : "details"}>
        <TabsList>
          <TabsTrigger value="suppliers">{t("rfq.tab.suppliers")} ({recipients.length})</TabsTrigger>
          <TabsTrigger value="quotes">{t("rfq.tab.quotes")} ({rfq.quotes.length})</TabsTrigger>
          <TabsTrigger value="summary">{t("quote.overview")}</TabsTrigger>
          <TabsTrigger value="details">{t("rfq.tab.details")}</TabsTrigger>
          <TabsTrigger value="activity">{t("rfq.tab.activity")}</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers" className="rounded-lg border bg-card">
          {recipients.length === 0 ? <p className="p-8 text-center text-muted-foreground">{t(rfq.status === "draft" ? "rfq.noSuppliersDraft" : "rfq.noSuppliers")}</p> : (
            <table className="w-full text-sm"><tbody>
              {recipients.map((r) => { const s = scores.get(r.supplier_company_id); return (
                <tr key={r.id} className="border-t first:border-0 [&>td]:px-4 [&>td]:py-3">
                  <td className="w-10 tabular-nums text-muted-foreground">#{r.rank}</td>
                  <td>{r.companies?.name}<div className="text-xs text-muted-foreground">{r.companies?.city}</div></td>
                  <td>{s && <TrustBadge score={s.score} breakdown={s.breakdown as Breakdown} dataDate={s.public_data_date} />}</td>
                  <td><StatusBadge kind="recipient" status={r.status} />
                    {r.decline_reason && <div className="mt-1 text-xs text-muted-foreground">{t(`reason.${r.decline_reason}` as TKey)}{r.decline_message && ` — ${r.decline_message}`}</div>}</td>
                </tr>); })}
            </tbody></table>)}
        </TabsContent>
        <TabsContent value="quotes" className="space-y-4">
          {rfq.quotes.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("rfq.noQuotes")}</p>}
          {rfq.quotes.map((qu) => <BuyerQuote key={qu.id} quote={qu} items={items} roundLimit={rfq.negotiation_round_limit} onChange={() => qc.invalidateQueries({ queryKey: ["rfqs"] })} />)}
          {recipients.filter((r) => !rfq.quotes.some((qu) => qu.recipient_id === r.id) && r.status !== "rerouted").map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-6">
              <ChatPanel rfqId={rfqId} recipientId={r.id} viewer="buyer" canSend={r.status !== "declined"} title={t("chat.with").replace("{name}", r.companies?.name ?? "")} />
            </div>))}
        </TabsContent>
        <TabsContent value="summary" className="rounded-lg border bg-card">
          {rfq.quotes.length === 0 ? <p className="p-8 text-center text-muted-foreground">{t("rfq.noQuotes")}</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3"><th>{t("trust.company")}</th><th>{t("rfq.version")}</th><th className="text-right">{t("rfq.total")}</th><th>{t("rfq.leadTime")}</th><th>{t("rfq.status")}</th></tr></thead>
              <tbody>{rfq.quotes.map((qu) => { const v = [...qu.quote_versions].sort((a, b) => b.version - a.version)[0]; return (
                <tr key={qu.id} className="border-t [&>td]:px-4 [&>td]:py-3">
                  <td>{qu.companies?.name}</td>
                  <td>v{v?.version} · {v?.party === "buyer" ? t("rfq.yourCounter") : t("rfq.supplierOffer")}</td>
                  <td className="text-right tabular-nums">{v && eur(Number(v.total))}</td>
                  <td>{v?.lead_time_days} {t("rfq.days")}</td>
                  <td><StatusBadge kind="quote" status={qu.status} /></td>
                </tr>); })}</tbody>
            </table>)}
        </TabsContent>
        <TabsContent value="details" className="rounded-lg border bg-card p-6 space-y-4 text-sm">
          {rfq.description && <p>{rfq.description}</p>}
          <p className="text-muted-foreground">{t("rfq.address")}: {rfq.delivery_address ?? "—"} · {t("rfq.date")}: {rfq.delivery_date_requested ?? "—"}</p>
          <table className="w-full">
            <thead className="text-left text-muted-foreground"><tr><th className="py-1">{t("rfq.category")}</th><th>{t("rfq.itemDescription")}</th><th>{t("rfq.standard")}</th><th className="text-right">{t("rfq.quantity")}</th></tr></thead>
            <tbody>{items.map((it) => (
              <tr key={it.id} className="border-t align-top"><td className="py-2">{it.categories?.name_en}</td>
                <td>{it.description}<div className="text-xs text-muted-foreground">{specsSummary(it.specs)}</div></td>
                <td>{it.standard ?? ""}</td>
                <td className="text-right tabular-nums">{Number(it.quantity)} {it.unit}{Number(it.waste_pct) > 0 && <span className="text-muted-foreground"> +{Number(it.waste_pct)}%</span>}</td></tr>))}
            </tbody>
          </table>
        </TabsContent>
        <TabsContent value="activity" className="rounded-lg border bg-card p-6">
          <ol className="space-y-3 text-sm">{activity.map((a, i) => (
            <li key={i} className="flex gap-4"><span className="w-40 shrink-0 text-muted-foreground">{when(a.at)}</span><span>{a.text}</span></li>))}
          </ol>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type BuyerQuoteProps = {
  quote: { id: string; rfq_id: string; recipient_id: string; status: string; round_count: number; companies: { name: string } | null; quote_versions: ThreadVersion[] };
  items: { id: string; description: string; quantity: number; unit: string | null }[];
  roundLimit: number; onChange: () => void;
};
function BuyerQuote({ quote, items, roundLimit, onChange }: BuyerQuoteProps) {
  const { t } = useI18n();
  const [countering, setCountering] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const versions = [...quote.quote_versions].sort((a, b) => a.version - b.version);
  const last = versions[versions.length - 1];
  const acts = nextActions({ status: quote.status, lastParty: last?.party ?? null, roundCount: quote.round_count, roundLimit });

  async function counter(o: Offer) {
    const { error } = await supabase.rpc("buyer_counter_quote", { _quote: quote.id, _offer: o });
    if (error) { toast.error(error.message); return false; }
    toast.success(t("quote.counterSent")); setCountering(false); onChange(); return true;
  }
  async function reject() {
    const { error } = await supabase.rpc("buyer_reject_quote", { _quote: quote.id, _reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success(t("quote.rejected")); setRejecting(false); onChange();
  }
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{quote.companies?.name}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("quote.rounds").replace("{n}", String(quote.round_count)).replace("{m}", String(roundLimit))}
          <StatusBadge kind="quote" status={quote.status} /></div>
      </div>
      <QuoteThread versions={versions} viewer="buyer" items={items} />
      {acts.roundLimitReached && <p className="rounded-md border border-warning bg-warning/15 p-3 text-sm">{t("quote.limit")}</p>}
      {last?.party === "buyer" && acts.buyerReject && <p className="text-sm text-muted-foreground">{t("quote.waitSupplier")}</p>}
      {!countering && !rejecting && acts.buyerReject && (
        <div className="flex flex-wrap items-center gap-2">
          {acts.buyerCounter && <Button onClick={() => setCountering(true)}>{t("quote.makeCounter")}</Button>}
          <Button variant="outline" onClick={() => setRejecting(true)}>{t("quote.reject")}</Button>
          <span className="text-xs text-muted-foreground">{t("quote.acceptSoon")}</span>
        </div>)}
      {countering && <OfferForm items={items} initial={last} submitLabel={t("quote.sendCounter")} onSubmit={counter} onCancel={() => setCountering(false)} />}
      <div className="border-t pt-4"><ChatPanel rfqId={quote.rfq_id} recipientId={quote.recipient_id} viewer="buyer" canSend={quote.status !== "rejected"} /></div>
      {rejecting && (
        <div className="space-y-2">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("quote.rejectReason")} aria-label={t("quote.rejectReason")} />
          <div className="flex gap-2"><Button variant="destructive" onClick={reject}>{t("quote.reject")}</Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>{t("quote.cancel")}</Button></div>
        </div>)}
    </div>
  );
}
