import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/rfq/status-badge";
import { specsSummary } from "@/components/rfq/spec-fields";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import type { Database } from "@/integrations/supabase/types";

type Reason = Database["public"]["Enums"]["decline_reason"];
const REASONS: Reason[] = ["out_of_stock", "cannot_meet_date", "order_too_small", "not_our_product", "other"];
type Magic = {
  status: string; has_quote: boolean;
  supplier: { name: string; is_claimed: boolean };
  rfq: { rfq_number: string; title: string; description: string | null; project_type: string; delivery_city: string | null; delivery_week: string | null; delivery_date_requested: string | null; buyer: string };
  items: { description: string; specs: Record<string, string | number | boolean>; quantity: number; unit: string | null; standard: string | null; waste_pct: number; category: string | null }[];
  messages: { body: string; party: string; at: string }[];
};

export const Route = createFileRoute("/q/$token")({
  head: () => ({
    meta: [
      { title: "Quote request — BuildSource LT" },
      { name: "description", content: "Reply to a construction quote request on BuildSource LT." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Quote request — BuildSource LT" },
      { property: "og:description", content: "Reply to a construction quote request on BuildSource LT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MagicPage,
});

function MagicPage() {
  const { token } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("out_of_stock");
  const [msg, setMsg] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["magic", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("magic_get", { _token: token });
      if (error) throw error;
      return data as unknown as Magic | null;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["magic", token] });

  if (q.isLoading) return <div className="p-6 text-muted-foreground">…</div>;
  if (!q.data) return <div className="mx-auto max-w-md p-6 text-center"><p className="font-display text-lg">{t("magic.invalid")}</p><Link to="/" className="mt-4 inline-block text-primary underline">BuildSource LT</Link></div>;
  const d = q.data;
  const active = d.status === "sent" || d.status === "viewed";

  async function ask() {
    setBusy(true);
    const { error } = await supabase.rpc("magic_ask", { _token: token, _body: question });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setQuestion(""); toast.success(t("inbox.sent")); refresh();
  }
  async function decline() {
    setBusy(true);
    const { error } = await supabase.rpc("magic_decline", { _token: token, _reason: reason, _message: msg });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false); toast.success(t("magic.closed")); refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink px-4 py-5 text-ink-foreground">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm opacity-80">BuildSource LT · {d.supplier.name}</p>
          <h1 className="mt-1 font-display text-xl font-semibold">{t("magic.invited")}</h1>
          <p className="text-sm opacity-80">{t("magic.noAccount")}</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <section className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div><p className="font-mono text-xs text-muted-foreground">{d.rfq.rfq_number}</p>
              <h2 className="font-display text-lg font-semibold">{d.rfq.title}</h2></div>
            <StatusBadge kind="recipient" status={d.status} />
          </div>
          <p className="text-sm text-muted-foreground">{d.rfq.buyer} · {t(`project.${d.rfq.project_type}` as TKey)}</p>
          <p className="text-sm">{d.rfq.delivery_city} · {d.rfq.delivery_week ?? "—"}{d.rfq.delivery_date_requested && ` (${d.rfq.delivery_date_requested})`}</p>
          {d.rfq.description && <p className="text-sm">{d.rfq.description}</p>}
        </section>

        <section className="space-y-2">
          {d.items.map((it, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 text-sm">
              <div className="flex justify-between gap-3"><span className="font-medium">{it.description}</span>
                <span className="shrink-0 tabular-nums">{Number(it.quantity)} {it.unit}</span></div>
              <p className="text-xs text-muted-foreground">{it.category}{it.standard && ` · ${it.standard}`}{Number(it.waste_pct) > 0 && ` · +${Number(it.waste_pct)}%`}</p>
              {specsSummary(it.specs) && <p className="mt-1 text-xs text-muted-foreground">{specsSummary(it.specs)}</p>}
            </div>))}
        </section>

        {active && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="lg" disabled><Send className="mr-2 h-4 w-4" />{t("inbox.quoteSoon")}</Button>
            <Button size="lg" variant="outline" onClick={() => setOpen(true)}><X className="mr-2 h-4 w-4" />{t("inbox.decline")}</Button>
          </div>)}
        {d.status === "declined" && <p className="rounded-md bg-muted p-3 text-sm">{t("magic.closed")}</p>}

        <section className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="flex items-center gap-2 font-medium"><MessageSquare className="h-4 w-4 text-primary" />{t("inbox.questions")}</h3>
          {d.messages.length === 0 ? <p className="text-sm text-muted-foreground">{t("inbox.noMessages")}</p> : (
            <ul className="space-y-2 text-sm">{d.messages.map((m, i) => (
              <li key={i} className={m.party === "supplier" ? "ml-auto max-w-[85%] rounded-lg bg-primary/10 p-3" : "max-w-[85%] rounded-lg bg-muted p-3"}>
                <p>{m.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(m.at).toLocaleString("en-GB")}</p></li>))}
            </ul>)}
          {active && (<>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("inbox.askPh")} rows={3} aria-label={t("inbox.ask")} />
            <Button className="w-full" onClick={ask} disabled={busy || !question.trim()}>{t("inbox.ask")}</Button>
          </>)}
        </section>

        {!d.supplier.is_claimed && d.has_quote && (
          <section className="rounded-lg border border-accent bg-accent/40 p-4 space-y-2">
            <p className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" />{t("magic.claim")}</p>
            <p className="text-sm">{t("magic.claimText")}</p>
            <Button asChild><Link to="/auth" search={{ mode: "signup", type: "supplier" }}>{t("magic.claimCta")}</Link></Button>
          </section>)}
      </main>

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
