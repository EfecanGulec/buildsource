import { tierProgress, type Tier } from "@/lib/pool";
import { useI18n } from "@/lib/i18n";

export function TierBar({ tiers, qty, unit }: { tiers: Tier[]; qty: number; unit: string }) {
  const { t } = useI18n();
  const p = tierProgress(tiers, qty);
  const top = Math.max(...tiers.map((x) => x.min_qty), 1);
  return (
    <div className="space-y-1.5">
      <div className="relative h-3 rounded-full bg-muted">
        <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${p.pct}%` }} />
        {tiers.map((x) => (
          <span key={x.min_qty} className="absolute top-0 h-3 w-px bg-foreground/40" style={{ left: `${(x.min_qty / top) * 100}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{qty} {unit} {p.current > 0 && <strong className="text-primary">· −{p.current}%</strong>}</span>
        <span>{p.next ? t("pool.more").replace("{n}", String(p.next.more)).replace("{u}", unit).replace("{p}", String(p.next.pct)) : t("pool.topTier")}</span>
      </div>
    </div>
  );
}
