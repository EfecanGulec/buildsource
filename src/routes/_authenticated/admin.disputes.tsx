import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/rfq/status-badge";
import { eur } from "@/components/rfq/quote-thread";
import { PhotoStrip } from "@/components/order/photos";
import { QueryState } from "@/components/query-state";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import type { Database } from "@/integrations/supabase/types";

type Outcome = Database["public"]["Enums"]["dispute_status"];
const OUTCOMES: Outcome[] = ["resolved_replacement", "resolved_partial_refund", "resolved_full_refund", "rejected"];

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  head: () => ({ meta: [{ title: "Disputes — BuildSource LT admin" }] }),
  component: AdminDisputes,
});

function AdminDisputes() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("disputes")
        .select("*, orders(order_number,total,buyer:companies!orders_buyer_company_id_fkey(name),supplier:companies!orders_supplier_company_id_fkey(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.disputes")}</h1>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} />
      {q.data?.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("adm.disputes.empty")}</p>}
      {(q.data ?? []).map((d) => <DisputeCard key={d.id} d={d} />)}
    </div>
  );
}

function DisputeCard({ d }: { d: { id: string; reason: string; description: string | null; held_amount: number; status: Outcome | "open"; photo_urls: string[]; resolution_note: string | null; created_at: string;
  orders: { order_number: string; total: number; buyer: { name: string } | null; supplier: { name: string } | null } | null } }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>("resolved_partial_refund");
  const [refund, setRefund] = useState(String(d.held_amount));
  const [note, setNote] = useState("");
  async function resolve() {
    const { error } = await supabase.rpc("admin_resolve_dispute", { _dispute: d.id, _outcome: outcome, _refund: Number(refund), _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success(t("adm.resolved")); qc.invalidateQueries({ queryKey: ["admin-disputes"] });
  }
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-mono text-xs text-muted-foreground">{d.orders?.order_number} · {new Date(d.created_at).toLocaleDateString("en-GB")}</p>
          <p className="font-medium">{d.reason}</p>
          <p className="text-muted-foreground">{d.orders?.buyer?.name} → {d.orders?.supplier?.name} · {eur(Number(d.orders?.total ?? 0))} · {t("ord.held")} {eur(Number(d.held_amount))}</p></div>
        <StatusBadge kind="dispute" status={d.status} />
      </div>
      {d.description && <p>{d.description}</p>}
      <PhotoStrip paths={d.photo_urls} />
      {d.resolution_note && <p className="text-muted-foreground">{d.resolution_note}</p>}
      {d.status === "open" && (
        <div className="grid gap-2 border-t pt-3 sm:grid-cols-[200px_160px_1fr_auto]">
          <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}><SelectTrigger aria-label={t("adm.resolve")}><SelectValue /></SelectTrigger>
            <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o} value={o}>{t(`status.dispute.${o}` as TKey)}</SelectItem>)}</SelectContent></Select>
          <Input type="number" value={refund} onChange={(e) => setRefund(e.target.value)} disabled={outcome !== "resolved_partial_refund"} aria-label={t("adm.refund")} />
          <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("adm.resolution")} aria-label={t("adm.resolution")} />
          <Button onClick={resolve}>{t("adm.resolve")}</Button>
        </div>)}
    </div>
  );
}
