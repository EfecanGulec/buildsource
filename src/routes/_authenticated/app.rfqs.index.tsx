import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/rfq/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";

export const Route = createFileRoute("/_authenticated/app/rfqs/")({
  head: () => ({ meta: [{ title: "My RFQs — BuildSource LT" }] }),
  component: MyRfqs,
});

function MyRfqs() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["rfqs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rfqs")
        .select("id,rfq_number,title,project_type,status,delivery_city,delivery_week,created_at,rfq_items(count),quotes(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("nav.rfqs")}</h1>
        <Button asChild><Link to="/app/create-rfq"><FilePlus2 className="mr-2 h-4 w-4" />{t("nav.createRfq")}</Link></Button>
      </div>
      <div className="rounded-lg border bg-card">
        {q.data && q.data.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">{t("rfq.none")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3">
              <th>{t("rfq.number")}</th><th>{t("rfq.title")}</th><th>{t("rfq.city")}</th><th>{t("rfq.week")}</th>
              <th className="text-right">{t("rfq.items")}</th><th className="text-right">{t("rfq.quotes")}</th><th>{t("rfq.status")}</th>
            </tr></thead>
            <tbody>
              {q.data?.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/50 [&>td]:px-4 [&>td]:py-3">
                  <td className="font-mono"><Link to="/app/rfqs/$rfqId" params={{ rfqId: r.id }} className="text-primary hover:underline">{r.rfq_number}</Link></td>
                  <td>{r.title}<div className="text-xs text-muted-foreground">{t(`project.${r.project_type}` as TKey)}</div></td>
                  <td>{r.delivery_city}</td><td className="font-mono text-xs">{r.delivery_week ?? "—"}</td>
                  <td className="text-right tabular-nums">{r.rfq_items[0]?.count ?? 0}</td>
                  <td className="text-right tabular-nums">{r.quotes[0]?.count ?? 0}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
