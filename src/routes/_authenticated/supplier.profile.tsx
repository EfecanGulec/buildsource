import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrustBadge, type Breakdown } from "@/components/trust-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/supplier/profile")({
  head: () => ({ meta: [{ title: "Company profile — BuildSource LT" }] }),
  component: Profile,
});

function Profile() {
  const { t } = useI18n();
  const { data: account } = useAccount();
  const cid = account?.company?.id;
  const q = useQuery({
    queryKey: ["trust", cid], enabled: !!cid,
    queryFn: async () => (await supabase.from("trust_scores").select("*").eq("company_id", cid!).maybeSingle()).data,
  });
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.profile")}</h1>
      <div className="rounded-lg border bg-card p-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold">{account?.company?.name}</p>
          <p className="text-sm text-muted-foreground">{account?.company?.city} · {account?.company?.company_code}</p>
        </div>
        {q.data && <div className="text-right"><p className="text-xs text-muted-foreground mb-1">Trust Score</p>
          <TrustBadge score={q.data.score} breakdown={q.data.breakdown as Breakdown} dataDate={q.data.public_data_date} /></div>}
      </div>
    </div>
  );
}
