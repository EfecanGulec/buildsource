import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/rfq/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/supplier/inbox/")({
  head: () => ({ meta: [{ title: "RFQ inbox — BuildSource LT" }] }),
  component: Inbox,
});

const ALL = "__all";

function Inbox() {
  const { t } = useI18n();
  const [cat, setCat] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [sort, setSort] = useState<"deadline" | "new">("new");
  const q = useQuery({
    queryKey: ["supplier-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rfq_recipients")
        .select("id,status,sent_at,reminder_sent_at,rfqs(id,rfq_number,title,delivery_city,delivery_date_requested,delivery_week,companies(name),rfq_items(quantity,unit,categories(name_en)))")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r) => r.rfqs);
    },
  });
  const rows = q.data ?? [];
  const cats = [...new Set(rows.flatMap((r) => r.rfqs!.rfq_items.map((i) => i.categories?.name_en ?? "")).filter(Boolean))].sort();
  const cities = [...new Set(rows.map((r) => r.rfqs!.delivery_city).filter(Boolean))].sort();
  const shown = rows
    .filter((r) => cat === ALL || r.rfqs!.rfq_items.some((i) => i.categories?.name_en === cat))
    .filter((r) => city === ALL || r.rfqs!.delivery_city === city)
    .sort((a, b) => sort === "new" ? (b.sent_at ?? "").localeCompare(a.sent_at ?? "")
      : (a.rfqs!.delivery_date_requested ?? "9").localeCompare(b.rfqs!.delivery_date_requested ?? "9"));

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.inbox")}</h1>
      <div className="flex flex-wrap gap-3">
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="w-52" aria-label={t("inbox.categories")}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>{t("inbox.allCategories")}</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Select value={city} onValueChange={setCity}><SelectTrigger className="w-44" aria-label={t("rfq.city")}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>{t("inbox.allCities")}</SelectItem>{cities.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={(v) => setSort(v as "deadline" | "new")}><SelectTrigger className="w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="new">Newest first</SelectItem><SelectItem value="deadline">{t("inbox.deadline")} ↑</SelectItem></SelectContent></Select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        {q.isLoading ? <p className="p-8 text-muted-foreground">…</p> : shown.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">{t("inbox.empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3">
              <th>RFQ</th><th>{t("rfq.title")}</th><th>{t("inbox.buyer")}</th><th>{t("rfq.city")}</th><th>{t("inbox.categories")}</th><th className="text-right">{t("rfq.quantity")}</th><th>{t("inbox.deadline")}</th><th>{t("rfq.status")}</th>
            </tr></thead>
            <tbody>{shown.map((r) => { const f = r.rfqs!; const items = f.rfq_items; return (
              <tr key={r.id} className="border-t [&>td]:px-4 [&>td]:py-3 hover:bg-muted/50">
                <td className="font-mono"><Link to="/supplier/inbox/$rfqId" params={{ rfqId: f.id }} className="text-primary hover:underline">{f.rfq_number}</Link></td>
                <td>{f.title}</td>
                <td>{f.companies?.name}</td>
                <td>{f.delivery_city}</td>
                <td className="text-muted-foreground">{[...new Set(items.map((i) => i.categories?.name_en))].join(", ")}</td>
                <td className="text-right tabular-nums">{items.length === 1 ? `${Number(items[0]!.quantity)} ${items[0]!.unit ?? ""}` : `${items.length} lines`}</td>
                <td className="whitespace-nowrap">{f.delivery_week ?? "—"}</td>
                <td><StatusBadge kind="recipient" status={r.status} /></td>
              </tr>); })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
