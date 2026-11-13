import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askAgent, type AgentResult } from "@/lib/ai-agent.functions";
import { sharedAiPrompt, type OfferDraft } from "@/lib/ai-agent";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import { hasContactInfo } from "@/lib/chat";

/** Private chat for one supplier thread (rfq_recipient). Refreshes every few seconds. */
export function ChatPanel({ rfqId, recipientId, viewer, canSend, title, onOfferDraft }: {
  rfqId: string; recipientId: string; viewer: "buyer" | "supplier"; canSend: boolean; title?: string;
  onOfferDraft?: (d: OfferDraft) => void;
}) {
  const { t, lang } = useI18n();
  const ask = useServerFn(askAgent);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQ, setAiQ] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLog, setAiLog] = useState<{ q: string; r: AgentResult }[]>([]);
  async function runAi(message: string, scope: "private" | "shared") {
    setAiBusy(true);
    try {
      const r = await ask({ data: { recipientId, scope, message, lang } });
      if (scope === "private") setAiLog((l) => [...l, { q: message, r }]);
      else qc.invalidateQueries({ queryKey: key });
      return r;
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); return null; }
    finally { setAiBusy(false); }
  }
  const chips = viewer === "buyer"
    ? [t("ai.chipCheck"), t("ai.chipCounter"), t("ai.chipBefore"), t("ai.chipSummary")]
    : [t("ai.chipMissing"), t("ai.chipQuote"), t("ai.chipSummary")];
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const key = ["chat", recipientId];
  const q = useQuery({
    queryKey: key, refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("id,body,sender_party,created_at,contains_contact_info,is_ai")
        .eq("recipient_id", recipientId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  async function send() {
    if (!account || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({ rfq_id: rfqId, recipient_id: recipientId, sender_party: viewer, sender_profile_id: account.user.id, body: body.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const text = body.trim();
    setBody(""); qc.invalidateQueries({ queryKey: key });
    const prompt = sharedAiPrompt(text);
    if (prompt) await runAi(prompt, "shared");
  }
  const msgs = q.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium"><MessageSquare className="h-4 w-4 text-primary" />{title ?? t("chat.title")}</h3>
        <Button size="sm" variant={aiOpen ? "default" : "outline"} onClick={() => setAiOpen((o) => !o)}>{t("ai.button")}</Button>
      </div>
      {aiOpen && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-accent/30 p-3 text-sm">
          <p className="flex items-center gap-1 font-medium"><Sparkles className="h-4 w-4 text-primary" />{t("ai.title")}</p>
          <p className="text-xs text-muted-foreground">{t("ai.privateNote")}</p>
          <div className="flex flex-wrap gap-1">{chips.map((c) => (
            <Button key={c} size="sm" variant="secondary" disabled={aiBusy} onClick={() => runAi(c, "private")}>{c}</Button>))}</div>
          {aiLog.map((e, i) => (
            <div key={i} className="space-y-1 rounded-md bg-card p-2">
              <p className="text-xs font-medium text-muted-foreground">{e.q}</p>
              <p className="whitespace-pre-wrap">{e.r.reply}</p>
              <p className="text-xs text-muted-foreground">{t("ai.label")}{e.r.source === "demo" ? ` · ${t("ai.demo")}` : ""}</p>
              <div className="flex flex-wrap gap-1">
                {e.r.message_draft && canSend && <Button size="sm" variant="outline" onClick={() => setBody(e.r.message_draft!)}>{t("ai.useDraft")}</Button>}
                {e.r.offer_draft && onOfferDraft && <Button size="sm" onClick={() => { onOfferDraft(e.r.offer_draft!); toast.success(t("ai.formFilled")); }}>{t("ai.openForm")}</Button>}
              </div>
            </div>))}
          {aiBusy && <p className="text-xs text-muted-foreground">{t("ai.thinking")}</p>}
          <div className="flex gap-2">
            <Textarea rows={1} value={aiQ} onChange={(e) => setAiQ(e.target.value)} placeholder={t("ai.placeholder")} aria-label={t("ai.placeholder")} />
            <Button disabled={aiBusy || !aiQ.trim()} onClick={() => { const q = aiQ.trim(); setAiQ(""); runAi(q, "private"); }}>{t("ai.ask")}</Button>
          </div>
        </div>)}
      {msgs.length === 0 ? <p className="text-sm text-muted-foreground">{t("inbox.noMessages")}</p> : (
        <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">{msgs.map((m) => (
          <li key={m.id} className={m.is_ai ? "mx-auto max-w-[90%] rounded-lg border border-primary/30 bg-accent/30 p-3" : m.sender_party === viewer ? "ml-auto max-w-[80%] rounded-lg bg-primary/10 p-3" : "max-w-[80%] rounded-lg bg-muted p-3"}>
            {m.is_ai && <p className="mb-1 flex items-center gap-1 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" />{t("ai.label")}</p>}
            <p className="whitespace-pre-wrap">{m.body}</p>
            {m.contains_contact_info && <p className="mt-1 flex items-center gap-1 text-xs text-warning-foreground"><AlertTriangle className="h-3 w-3" />{t("chat.contactWarn")}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("en-GB")}</p></li>))}
        </ul>)}
      {canSend && (<>
        {hasContactInfo(body) && <p className="flex items-center gap-1 rounded-md border border-warning bg-warning/15 p-2 text-xs"><AlertTriangle className="h-3 w-3" />{t("chat.contactWarn")}</p>}
        <div className="flex gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button onClick={send} disabled={busy || !body.trim()}>{t("inbox.send")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("chat.priceNote")} {t("ai.sharedHint")}</p>
      </>)}
    </div>
  );
}
