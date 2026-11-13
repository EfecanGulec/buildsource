import { Button } from "@/components/ui/button";
import { PoolStatus } from "@/components/pool/pool-card";
import { TierBar } from "@/components/pool/tier-bar";
import { eur } from "@/components/rfq/quote-thread";
import { Countdown } from "@/components/countdown";
import { useI18n } from "@/lib/i18n";
import type { Tier } from "@/lib/pool";

type Row = { id: string; product_name: string; unit: string; base_price: number; tiers: unknown; deadline: string | null; status: string;
  final_unit_price: number | null; companies: { name: string } | null; totals: { total_qty: number; members: number; confirmed_qty: number } };

/** Pool list for supplier (own pools) and admin (all pools) with close actions. */
export function PoolTable({ rows, onClose, onEndWindow }: { rows: Row[]; onClose: (id: string) => void; onEndWindow?: (id: string) => void }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("pool.empty")}</p>;
  return (
    <div className="space-y-3">{rows.map((p) => (
      <div key={p.id} className="rounded-lg border bg-card p-5 space-y-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-medium">{p.product_name}</p>
            <p className="text-muted-foreground">{p.companies?.name} · {t("pool.maxPrice")} {eur(Number(p.base_price))} · {p.totals.members} {t("pool.members")} · {t("pool.endsIn")} <Countdown to={p.deadline} />
              {p.final_unit_price != null && <> · {t("pool.finalPrice")} {eur(Number(p.final_unit_price))}</>}
              {p.status !== "open" && <> · {p.totals.confirmed_qty} {p.unit} {t("pool.confirmedQty")}</>}</p></div>
          <div className="flex items-center gap-2"><PoolStatus status={p.status} />
            {p.status === "open" && <Button size="sm" variant="outline" onClick={() => onClose(p.id)}>{t("pool.closeNow")}</Button>}
            {p.status === "confirming" && onEndWindow && <Button size="sm" variant="outline" onClick={() => onEndWindow(p.id)}>{t("pool.endWindow")}</Button>}</div>
        </div>
        <TierBar tiers={(p.tiers as Tier[]) ?? []} qty={p.totals.total_qty} unit={p.unit} />
      </div>))}</div>
  );
}
