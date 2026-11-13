import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/rfq/status-badge";
import { ChatPanel } from "@/components/rfq/chat-panel";
import { OfferForm, type Offer } from "@/components/rfq/offer-form";
import type { OfferDraft } from "@/lib/ai-agent";
import { QuoteThread, type ThreadVersion } from "@/components/rfq/quote-thread";
import { nextActions } from "@/lib/quote";
import { specsSummary } from "@/components/rfq/spec-fields";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import type { Database } from "@/integrations/supabase/types";

type Reason = Database["public"]["Enums"]["decline_reason"];
const REASONS: Reason[] = ["out_of_stock", "cannot_meet_date", "order_too_small", "not_our_product", "other"];

export const Route = createFileRoute("/_authenticated/supplier/inbox/$rfqId")({
  head: () => ({ meta: [{ title: "RFQ — BuildSource LT" }] }),
  component: SupplierRfq,
});

function SupplierRfq() {
  const { rfqId } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: account } = useAccount();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("out_of_stock");
  const [msg, setMsg] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const useDraft = (d: OfferDraft) => { setDraft(d); setDraftKey((k) => k + 1); setQuoting(true); };

  const q = useQuery({
    queryKey: ["supplier-rfq", rfqId],
    queryFn: async () => {
      const { data: rec, error } = await supabase.from("rfq_recipients")
        .select("id,status,reminder_sent_at,decline_reason,rfqs(*,companies(name,city),rfq_items(*,categories(name_en)))")
        .eq("rfq_id", rfqId).maybeSingle();
      if (error) throw error;
      if (!rec) return null;
      const { data: msgs } = await supabase.from("messages").select("id,body,sender_party,created_at").eq("recipient_id", rec.id).order("created_at");
      await supabase.rpc("expire_stale_quotes");
      const { data: quote } = await supabase.from("quotes").select("*, quote_versions(*), agreements(id,status)").eq("rfq_id", rfqId).maybeSingle();
      // Spec 18.3: own catalogue prices as hints per item category (hints only; the signed quote always wins).
      const catIds = [...new Set((rec.rfqs?.rfq_items ?? []).map((i) => i.category_id).filter(Boolean))] as string[];
      const { data: prods } = catIds.length
        ? await supabase.from("products").select("category_id,name,list_price,unit,stock_qty,price_updated_at").eq("is_active", true).in("category_id", catIds).not("list_price", "is", null).order("list_price")
        : { data: [] };
      return { rec, msgs: msgs ?? [], quote, prods: prods ?? [] };
    },
  });

  useEffect(() => {
    if (q.data?.rec.status === "sent") {
      supabase.rpc("supplier_view_rfq", { _rfq: rfqId }).then(() => qc.invalidateQueries({ queryKey: ["supplier-inbox"] }));
    }
  }, [q.data?.rec.status, rfqId, qc]);

  if (q.isLoading) return <p className="text-muted-foreground">…</p>;
  if (!q.data?.rec.rfqs) return <p className="text-muted-foreground">{t("rfq.notFound")}</p>;
  const { rec, msgs, quote, prods } = q.data;
  const rfq = rec.rfqs!;
  const items = [...rfq.rfq_items].sort((a, b) => a.sort_order - b.sort_order);
  const hints = Object.fromEntries(items.flatMap((i) => {
    const m = prods.filter((p) => p.category_id === i.category_id);
    const best = m.find((p) => (p.stock_qty ?? 0) > 0) ?? m[0];
    return best ? [[i.id, { name: best.name, price: Number(best.list_price), unit: best.unit, updated: best.price_updated_at }]] : [];
  }));
  const canAct = rec.status === "sent" || rec.status === "viewed";
  const versions = [...(quote?.quote_versions ?? [])].sort((a, b) => a.version - b.version);
  const last = versions[versions.length - 1];
  const acts = quote ? nextActions({ status: quote.status, lastParty: last?.party ?? null, roundCount: quote.round_count, roundLimit: rfq.negotiation_round_limit }) : null;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["supplier-rfq", rfqId] }); qc.invalidateQueries({ queryKey: ["supplier-inbox"] }); };

  async function decline() {
    setBusy(true);
    const { error } = await supabase.rpc("supplier_decline_rfq", { _rfq: rfqId, _reason: reason, _message: msg });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false); toast.success(t("inbox.declined")); refresh();
  }
  async function sendOffer(o: Offer) {
    const { error } = await supabase.rpc("supplier_send_quote", { _rfq: rfqId, _offer: o });
    if (error) { toast.error(error.message); return false; }
    toast.success(t("quote.sent")); setQuoting(false); refresh(); return true;
  }
  async function acceptCounter() {
    const { data, error } = await supabase.rpc("supplier_accept_counter", { _rfq: rfqId });
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/supplier/agreements/$agreementId", params: { agreementId: data } });
  }
  async function rejectCounter() {
    const { error } = await supabase.rpc("supplier_reject_counter", { _rfq: rfqId });
    if (error) { toast.error(error.message); return; }
    toast.success(t("quote.rejected")); refresh();
  }
  async function ask() {
    if (!question.trim() || !account) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      rfq_id: rfqId, recipient_id: rec.id, sender_party: "supplier", sender_profile_id: account.user.id, body: question.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setQuestion(""); toast.success(t("inbox.sent")); refresh();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/supplier/inbox" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t("nav.inbox")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{rfq.rfq_number}</p>
          <h1 className="font-display text-2xl font-semibold">{rfq.title}</h1>
          <p className="text-sm text-muted-foreground">{rfq.companies?.name} · {t(`project.${rfq.project_type}` as TKey)} · {rfq.delivery_city} · {rfq.delivery_week}</p>
        </div>
        <StatusBadge kind="recipient" status={rec.status} />
      </div>
      {canAct && rec.reminder_sent_at && <p className="rounded-md border border-warning bg-warning/15 p-3 text-sm">{t("inbox.reminder")}</p>}

      <div className="rounded-lg border bg-card p-6 space-y-4 text-sm">
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
      </div>

      {canAct && !quoting && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setQuoting(true)}><Send className="mr-2 h-4 w-4" />{t("inbox.sendQuote")}</Button>
          <Button variant="outline" onClick={() => setOpen(true)}><X className="mr-2 h-4 w-4" />{t("inbox.decline")}</Button>
        </div>
      )}
      {quote && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">{t("quote.history")}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {t("quote.rounds").replace("{n}", String(quote.round_count)).replace("{m}", String(rfq.negotiation_round_limit))}
              <StatusBadge kind="quote" status={quote.status} /></div>
          </div>
          <QuoteThread versions={versions as ThreadVersion[]} viewer="supplier" items={items} />
          {quote.agreements.filter((a) => a.status !== "cancelled").map((a) => (
            <Button key={a.id} asChild><Link to="/supplier/agreements/$agreementId" params={{ agreementId: a.id }}>{t("agr.open")}</Link></Button>))}
          {acts?.supplierRevise && !quoting && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setQuoting(true)}>{t("quote.revise")}</Button>
              <Button variant="outline" onClick={rejectCounter}>{t("quote.rejectCounter")}</Button>
              <Button variant="secondary" onClick={acceptCounter}>{t("quote.acceptCounter")}</Button>
            </div>)}
          {quote.status === "sent" && <p className="text-sm text-muted-foreground">{t("quote.waitBuyer")}</p>}
          {(quote.status === "rejected" || quote.status === "expired" || quote.status === "withdrawn") && <p className="text-sm text-muted-foreground">{t("quote.closed")}</p>}
        </div>
      )}
      {quoting && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">{quote ? t("quote.revise") : t("quote.yourQuote")}</h2>
          <OfferForm key={draftKey} items={items} hints={hints} initial={draft ? fromDraft(last, draft) : last} draftMessage={draft?.message} submitLabel={quote ? t("quote.revise") : t("quote.send")} onSubmit={sendOffer} onCancel={() => setQuoting(false)} />
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        <ChatPanel rfqId={rfqId} recipientId={rec.id} viewer="supplier" canSend={rec.status !== "declined" && rec.status !== "rerouted"} onOfferDraft={!quote || acts?.supplierRevise ? useDraft : undefined} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("inbox.declineTitle")}</DialogTitle></DialogHeader>
          <label className="block space-y-1 text-sm"><span>{t("inbox.reason")}</span>
            <Select value={reason} onValueChange={(v) => setReason(v as Reason)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{t(`reason.${r}` as TKey)}</SelectItem>)}</SelectContent></Select></label>
          <label className="block space-y-1 text-sm"><span>{t("inbox.message")}</span>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} /></label>
          <DialogFooter><Button variant="destructive" onClick={decline} disabled={busy}>{t("inbox.decline")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fromDraft<T extends object>(last: T | null | undefined, d: OfferDraft) {
  return { ...(last ?? {}), lines: d.lines, delivery_cost: d.delivery_cost ?? (last as { delivery_cost?: number } | null)?.delivery_cost ?? 0,
    lead_time_days: d.lead_time_days ?? (last as { lead_time_days?: number | null } | null)?.lead_time_days ?? null } as T & { lines: unknown; delivery_cost: number; lead_time_days: number | null; delivery_date: string | null; valid_until: string | null; payment_terms: string | null };
}
