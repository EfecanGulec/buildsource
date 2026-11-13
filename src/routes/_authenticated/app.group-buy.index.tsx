import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PoolCard } from "@/components/pool/pool-card";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { POOL_COLS, withTotals } from "@/lib/pool-data";

export const Route = createFileRoute("/_authenticated/app/group-buy/")({
  head: () => ({ meta: [{ title: "Group Buy — BuildSource LT" }] }),
  component: Pools,
});

function Pools() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["pools"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_buy_pools").select(POOL_COLS).order("deadline");
      if (error) throw error;
      return withTotals(data);
    },
  });
  return (
    <div className="max-w-5xl space-y-6">
      <div><h1 className="font-display text-2xl font-semibold">{t("nav.groupBuy")}</h1>
        <p className="text-sm text-muted-foreground">{t("pool.browseIntro")}</p></div>
      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />)}</div>}
      {q.data?.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("pool.empty")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{(q.data ?? []).map((p) => <PoolCard key={p.id} p={p} />)}</div>
    </div>
  );
}
