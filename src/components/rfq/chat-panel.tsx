import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import { hasContactInfo } from "@/lib/chat";

/** Private chat for one supplier thread (rfq_recipient). Refreshes every few seconds. */
export function ChatPanel({ rfqId, recipientId, viewer, canSend, title }: {
  rfqId: string; recipientId: string; viewer: "buyer" | "supplier"; canSend: boolean; title?: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const key = ["chat", recipientId];
  const q = useQuery({
    queryKey: key, refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("id,body,sender_party,created_at,contains_contact_info")
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
    setBody(""); qc.invalidateQueries({ queryKey: key });
  }
  const msgs = q.data ?? [];
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-medium"><MessageSquare className="h-4 w-4 text-primary" />{title ?? t("chat.title")}</h3>
      {msgs.length === 0 ? <p className="text-sm text-muted-foreground">{t("inbox.noMessages")}</p> : (
        <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">{msgs.map((m) => (
          <li key={m.id} className={m.sender_party === viewer ? "ml-auto max-w-[80%] rounded-lg bg-primary/10 p-3" : "max-w-[80%] rounded-lg bg-muted p-3"}>
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
        <p className="text-xs text-muted-foreground">{t("chat.priceNote")}</p>
      </>)}
    </div>
  );
}
