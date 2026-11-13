import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PoolTable } from "@/components/pool/pool-table";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { POOL_COLS, withTotals } from "@/lib/pool-data";

export const Route = createFileRoute("/_authenticated/admin/pools")({
  head: () => ({ meta: [{ title: "Group Buy pools — BuildSource LT admin" }] }),
  component: AdminPools,
});

function AdminPools() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-pools"], queryFn: async () => {
    const { data, error } = await supabase.from("group_buy_pools").select(POOL_COLS).order("created_at", { ascending: false });
    if (error) throw error;
    return withTotals(data);
  } });
  const act = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p; if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["admin-pools"] });
  };
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.pools")}</h1>
      {q.data && <PoolTable rows={q.data} onClose={(id) => act(supabase.rpc("close_pool_now", { _pool: id }))}
        onEndWindow={(id) => act(supabase.rpc("end_pool_window_now", { _pool: id }))} />}
    </div>
  );
}
