import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/rfq/status-badge";
import { OfferForm, type Offer } from "@/components/rfq/offer-form";
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
  const { data: account } = useAccount();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("out_of_stock");
  const [msg, setMsg] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);

  const q = useQuery({
    queryKey: ["supplier-rfq", rfqId],
    queryFn: async () => {
      const { data: rec, error } = await supabase.from("rfq_recipients")
        .select("id,status,reminder_sent_at,decline_reason,rfqs(*,companies(name,city),rfq_items(*,categories(name_en)))")
        .eq("rfq_id", rfqId).maybeSingle();
      if (error) throw error;
      if (!rec) return null;
      const { data: msgs } = await supabase.from("messages").select("id,body,sender_party,created_at").eq("recipient_id", rec.id).order("created_at");
      const { data: quote } = await supabase.from("quotes").select("*, quote_versions(*)").eq("rfq_id", rfqId).maybeSingle();
      return { rec, msgs: msgs ?? [], quote };
    },
  });

  useEffect(() => {
    if (q.data?.rec.status === "sent") {
      supabase.rpc("supplier_view_rfq", { _rfq: rfqId }).then(() => qc.invalidateQueries({ queryKey: ["supplier-inbox"] }));
    }
  }, [q.data?.rec.status, rfqId, qc]);

  if (q.isLoading) return <p className="text-muted-foreground">…</p>;
  if (!q.data?.rec.rfqs) return <p className="text-muted-foreground">{t("rfq.notFound")}</p>;
  const { rec, msgs, quote } = q.data;
  const rfq = rec.rfqs!;
  const items = [...rfq.rfq_items].sort((a, b) => a.sort_order - b.sort_order);
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
          {acts?.supplierRevise && !quoting && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setQuoting(true)}>{t("quote.revise")}</Button>
              <Button variant="outline" onClick={rejectCounter}>{t("quote.rejectCounter")}</Button>
              <span className="self-center text-xs text-muted-foreground">{t("quote.acceptSoon")}</span>
            </div>)}
          {quote.status === "sent" && <p className="text-sm text-muted-foreground">{t("quote.waitBuyer")}</p>}
          {(quote.status === "rejected" || quote.status === "expired" || quote.status === "withdrawn") && <p className="text-sm text-muted-foreground">{t("quote.closed")}</p>}
        </div>
      )}
      {quoting && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">{quote ? t("quote.revise") : t("quote.yourQuote")}</h2>
          <OfferForm items={items} initial={last} submitLabel={quote ? t("quote.revise") : t("quote.send")} onSubmit={sendOffer} onCancel={() => setQuoting(false)} />
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><MessageSquare className="h-5 w-5 text-primary" />{t("inbox.questions")}</h2>
        {msgs.length === 0 ? <p className="text-sm text-muted-foreground">{t("inbox.noMessages")}</p> : (
          <ul className="space-y-2 text-sm">{msgs.map((m) => (
            <li key={m.id} className={m.sender_party === "supplier" ? "ml-auto max-w-[80%] rounded-lg bg-primary/10 p-3" : "max-w-[80%] rounded-lg bg-muted p-3"}>
              <p>{m.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("en-GB")}</p></li>))}
          </ul>)}
        {rec.status !== "declined" && rec.status !== "rerouted" && (
          <div className="flex gap-2">
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("inbox.askPh")} rows={2} aria-label={t("inbox.ask")} />
            <Button onClick={ask} disabled={busy || !question.trim()}>{t("inbox.send")}</Button>
          </div>)}
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
