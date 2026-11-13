import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { buildSeries } from "@/lib/price-index";

export const Route = createFileRoute("/_authenticated/app/price-index")({
  head: () => ({ meta: [{ title: "Price Index (beta) — BuildSource LT" }] }),
  component: PriceIndex,
});

function PriceIndex() {
  const { t } = useI18n();
  const [region, setRegion] = useState("all");
  const q = useQuery({
    queryKey: ["price-index"],
    queryFn: async () => {
      const [{ data: rows, error }, { data: cats }] = await Promise.all([
        supabase.from("price_index").select("*"),
        supabase.from("categories").select("id,name_en,default_unit,parent_id").order("sort_order"),
      ]);
      if (error) throw error;
      return { series: buildSeries(rows ?? []), cats: cats ?? [] };
    },
  });
  if (q.isLoading) return <div className="h-72 max-w-5xl animate-pulse rounded-lg bg-muted" />;
  const { series = [], cats = [] } = q.data ?? {};
  const regions = [...new Set(series.map((s) => s.region))].sort();
  const shown = series.filter((s) => region === "all" || s.region === region);
  const withData = new Set(series.map((s) => s.category_id));
  const leaf = cats.filter((c) => c.parent_id && !withData.has(c.id));
  const name = (id: string) => cats.find((c) => c.id === id)?.name_en ?? "—";
  const unit = (id: string) => cats.find((c) => c.id === id)?.default_unit ?? "";
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-semibold">{t("nav.priceIndex")}</h1>
          <p className="text-sm text-muted-foreground">{t("pi.intro")}</p></div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-44" aria-label={t("pool.region")}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("pi.allRegions")}</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {shown.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("pi.noData")}</p>}
      <div className="grid gap-4 lg:grid-cols-2">{shown.map((s) => {
        const last = s.points.at(-1)!;
        return (
          <div key={`${s.category_id}${s.region}`} className="min-w-0 rounded-lg border bg-card p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-display font-semibold">{name(s.category_id)}</p><p className="text-sm text-muted-foreground">{s.region}</p></div>
              <div className="text-right"><p className="font-display text-lg font-semibold tabular-nums">{eur(last.avg)}</p>
                <p className="text-xs text-muted-foreground">/ {unit(s.category_id)} · {last.month} · {last.n} {t("pi.samples")}</p></div>
            </div>
            <ChartContainer config={{ avg: { label: t("pi.avg"), color: "var(--primary)" } }} className="h-48 w-full">
              <LineChart data={s.points} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis width={44} tickLine={false} axisLine={false} fontSize={11} domain={["auto", "auto"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="avg" type="monotone" stroke="var(--color-avg)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          </div>);
      })}</div>
      {leaf.length > 0 && (
        <div className="rounded-lg border bg-card p-5 text-sm">
          <p className="mb-2 font-medium">{t("pi.notEnough")}</p>
          <p className="text-muted-foreground">{leaf.map((c) => c.name_en).join(" · ")}</p>
        </div>)}
    </div>
  );
}
