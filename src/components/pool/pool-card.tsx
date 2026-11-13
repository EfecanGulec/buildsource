import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { TierBar } from "@/components/pool/tier-bar";
import { eur } from "@/components/rfq/quote-thread";
import { useI18n } from "@/lib/i18n";
import { timeLeft, type Tier } from "@/lib/pool";
import type { TKey } from "@/lib/translations";

export type PoolRow = { id: string; product_name: string; unit: string; base_price: number; tiers: unknown; deadline: string | null;
  status: string; region: string | null; images: string[]; companies: { name: string } | null; totals?: { total_qty: number; members: number } };

export function PoolStatus({ status }: { status: string }) {
  const { t } = useI18n();
  return <Badge variant={status === "open" ? "default" : "secondary"}>{t(`pool.status.${status}` as TKey)}</Badge>;
}

export function PoolCard({ p }: { p: PoolRow }) {
  const { t } = useI18n();
  return (
    <Link to="/app/group-buy/$poolId" params={{ poolId: p.id }} className="block rounded-lg border bg-card p-5 space-y-3 hover:border-primary">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-display font-semibold">{p.product_name}</p>
          <p className="text-sm text-muted-foreground">{p.companies?.name} · {p.region ?? "—"}</p></div>
        <PoolStatus status={p.status} />
      </div>
      <p className="text-sm">{t("pool.maxPrice")} <strong>{eur(Number(p.base_price))}</strong> / {p.unit}</p>
      <TierBar tiers={(p.tiers as Tier[]) ?? []} qty={Number(p.totals?.total_qty ?? 0)} unit={p.unit} />
      <p className="text-xs text-muted-foreground">{p.totals?.members ?? 0} {t("pool.members")} · {t("pool.endsIn")} {timeLeft(p.deadline)}</p>
    </Link>
  );
}
