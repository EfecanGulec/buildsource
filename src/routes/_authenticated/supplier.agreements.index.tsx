import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { eur } from "@/components/rfq/quote-thread";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/supplier/agreements/")({
  head: () => ({ meta: [{ title: "Agreements — BuildSource LT" }] }),
  component: Agreements,
});

function Agreements() {
  const { t } = useI18n();
  const me = useAccount().data?.company?.id;
  const q = useQuery({ queryKey: ["my-agreements", me], enabled: !!me, queryFn: async () => {
    const { data, error } = await supabase.from("agreements")
      .select("id,status,total,created_at,supplier_signed_at,buyer_signed_at,rfqs(rfq_number,title,companies(name)),quotes!inner(supplier_company_id)")
      .eq("quotes.supplier_company_id", me!).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } });
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.agreements")}</h1>
      {q.isLoading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
      {q.data?.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("sa.empty")}</p>}
      <div className="space-y-2">{(q.data ?? []).map((a) => (
        <Link key={a.id} to="/supplier/agreements/$agreementId" params={{ agreementId: a.id }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm hover:border-primary">
          <div><p className="font-mono text-xs text-muted-foreground">{a.rfqs?.rfq_number}</p><p className="font-medium">{a.rfqs?.title}</p>
            <p className="text-muted-foreground">{a.rfqs?.companies?.name}</p></div>
          <div className="text-right"><p className="font-display font-semibold tabular-nums">{eur(Number(a.total))}</p>
            <p className="text-xs">{a.status === "signed" ? t("sa.signed") : a.status === "cancelled" ? t("sa.cancelled") : a.supplier_signed_at ? t("agr.waitOther") : t("sa.needsYou")}</p></div>
        </Link>))}</div>
    </div>
  );
}
