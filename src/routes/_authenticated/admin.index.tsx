import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Gavel, Package, Plug, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — BuildSource LT" }, { name: "description", content: "Platform overview for BuildSource LT admins." }] }),
  component: AdminHome,
});

async function count(table: "companies" | "rfqs" | "orders" | "disputes" | "group_buy_pools" | "integrations", f?: (q: any) => any) {
  let q: any = supabase.from(table).select("id", { count: "exact", head: true });
  if (f) q = f(q);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

function AdminHome() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["admin-home"],
    queryFn: async () => {
      const [companies, rfqs, orders, disputes, pools, live] = await Promise.all([
        count("companies"), count("rfqs"), count("orders"),
        count("disputes", (x) => x.eq("status", "open")),
        count("group_buy_pools", (x) => x.eq("status", "open")),
        count("integrations", (x) => x.eq("mode", "live")),
      ]);
      return { companies, rfqs, orders, disputes, pools, live };
    },
  });
  const d = q.data;
  const cards = d ? [
    { to: "/admin/companies", icon: Building2, label: t("ah.companies"), n: d.companies },
    { to: "/admin/trust-scores", icon: FileText, label: t("ah.rfqs"), n: d.rfqs },
    { to: "/admin/trust-scores", icon: Package, label: t("ah.orders"), n: d.orders },
    { to: "/admin/disputes", icon: Gavel, label: t("ah.disputes"), n: d.disputes },
    { to: "/admin/pools", icon: Users, label: t("ah.pools"), n: d.pools },
    { to: "/admin/integrations", icon: Plug, label: t("ah.live"), n: d.live },
  ] as const : [];
  return (
    <div className="max-w-5xl space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("area.admin")}</p>
        <h1 className="mt-1 font-display text-3xl">{t("nav.dashboard")}</h1></div>
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-lg border bg-card p-5 hover:border-primary transition-colors">
            <c.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 font-display text-3xl font-semibold">{c.n}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
