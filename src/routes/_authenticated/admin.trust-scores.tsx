import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TrustBadge, type Breakdown } from "@/components/trust-badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/trust-scores")({
  head: () => ({ meta: [{ title: "Trust Scores — BuildSource LT" }] }),
  component: TrustScores,
});

function TrustScores() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-trust-scores"],
    queryFn: async () => {
      const [{ data: companies, error }, { data: reliability }] = await Promise.all([
        supabase.from("companies").select("id,name,type,city,trust_scores(score,breakdown,public_data_date,computed_at)").order("name"),
        supabase.from("buyer_reliability").select("company_id,score,orders_completed,pool_no_shows,late_confirmations"),
      ]);
      if (error) throw error;
      return { companies: companies ?? [], reliability: reliability ?? [] };
    },
  });
  const m = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc("recompute_all_scores"); if (error) throw error; return data; },
    onSuccess: (n) => { toast.success(t("trust.recomputed").replace("{n}", String(n))); qc.invalidateQueries({ queryKey: ["admin-trust-scores"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const suppliers = (q.data?.companies ?? []).filter((c) => c.type === "supplier")
    .map((c) => ({ ...c, ts: Array.isArray(c.trust_scores) ? c.trust_scores[0] : c.trust_scores }))
    .sort((a, b) => (b.ts?.score ?? -1) - (a.ts?.score ?? -1));
  const buyers = (q.data?.companies ?? []).filter((c) => c.type === "buyer");
  const rel = new Map((q.data?.reliability ?? []).map((r) => [r.company_id, r]));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-semibold">{t("nav.trustScores")}</h1>
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${m.isPending ? "animate-spin" : ""}`} />{t("trust.recompute")}
        </Button>
      </div>
      <p className="text-muted-foreground">{t("trust.intro")}</p>
      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-display text-lg font-semibold mb-3">{t("trust.suppliers")}</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr>
            <th className="py-2">{t("trust.company")}</th><th>{t("trust.score")}</th>
            <th>{t("trust.src.public")}</th><th>{t("trust.src.platform")}</th><th>{t("trust.orders")}</th>
          </tr></thead>
          <tbody>
            {suppliers.map((c) => {
              const b = (c.ts?.breakdown ?? null) as Breakdown | null;
              return (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{c.name}<div className="text-xs text-muted-foreground">{c.city}</div></td>
                  <td>{c.ts ? <TrustBadge score={c.ts.score} breakdown={b} dataDate={c.ts.public_data_date} /> : "—"}</td>
                  <td className="tabular-nums">{b?.public_points ?? "—"}</td>
                  <td className="tabular-nums">{b?.platform_points ?? "—"}{b?.platform_neutral ? ` (${t("trust.neutralShort")})` : ""}</td>
                  <td className="tabular-nums">{b?.completed_orders ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-display text-lg font-semibold mb-3">{t("trust.buyers")}</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr>
            <th className="py-2">{t("trust.company")}</th><th>{t("trust.score")}</th><th>{t("trust.orders")}</th><th>{t("trust.noShows")}</th><th>{t("trust.late")}</th>
          </tr></thead>
          <tbody>
            {buyers.map((c) => { const r = rel.get(c.id); return (
              <tr key={c.id} className="border-t">
                <td className="py-2">{c.name}</td><td className="tabular-nums font-semibold">{r?.score ?? "—"}</td>
                <td className="tabular-nums">{r?.orders_completed ?? 0}</td><td className="tabular-nums">{r?.pool_no_shows ?? 0}</td>
                <td className="tabular-nums">{r?.late_confirmations ?? 0}</td>
              </tr>); })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
