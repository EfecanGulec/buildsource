import { useQuery } from "@tanstack/react-query";
import { Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";

export function IntegrationLevelBadge({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["integration-level", companyId],
    queryFn: async () => (await supabase.rpc("supplier_integration_level", { _company: companyId })).data ?? 0,
  });
  const lvl = q.data ?? 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
      title={t("cat.levelHelp")}>
      <Plug className="h-3 w-3" /> {t("cat.level")} {lvl} · {t(`cat.level${lvl}` as TKey)}
    </span>
  );
}
