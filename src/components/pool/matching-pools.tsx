import { useQuery } from "@tanstack/react-query";
import { PoolCard } from "@/components/pool/pool-card";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { POOL_COLS, withTotals } from "@/lib/pool-data";

/** Open pools that cover categories in the RFQ (Create RFQ, review step). */
export function MatchingPools({ categoryIds }: { categoryIds: string[] }) {
  const { t } = useI18n();
  const ids = [...new Set(categoryIds)].sort();
  const q = useQuery({
    queryKey: ["matching-pools", ids], enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("group_buy_pools").select(POOL_COLS).eq("status", "open").in("category_id", ids);
      if (error) throw error;
      return withTotals(data);
    },
  });
  if (!q.data?.length) return null;
  return (
    <div className="space-y-2 border-t pt-4">
      <p className="font-medium">{t("pool.matching")}</p>
      <p className="text-muted-foreground">{t("pool.matchingHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">{q.data.map((p) => <PoolCard key={p.id} p={p} />)}</div>
    </div>
  );
}
