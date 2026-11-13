import { useI18n } from "@/lib/i18n";

export const eur = (n: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

export type ThreadVersion = {
  version: number; party: "buyer" | "supplier"; total: number | string; delivery_cost: number | string;
  lead_time_days: number | null; delivery_date: string | null; valid_until: string | null; payment_terms: string | null;
  message: string | null; created_at: string; lines: unknown;
};

/** Every offer and counter-offer, oldest first. `viewer` decides which side is "you". */
export function QuoteThread({ versions, viewer, items }: { versions: ThreadVersion[]; viewer: "buyer" | "supplier"; items: { id: string; description: string }[] }) {
  const { t } = useI18n();
  const names = new Map(items.map((i) => [i.id, i.description]));
  const sorted = [...versions].sort((a, b) => a.version - b.version);
  return (
    <ol className="space-y-3">
      {sorted.map((v) => {
        const mine = v.party === viewer;
        return (
          <li key={v.version} className={`rounded-lg border p-4 text-sm ${mine ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">v{v.version} · {v.party === "buyer" ? t("quote.counter") : t("quote.offer")} {mine && `(${t("quote.you")})`}</span>
              <span className="font-display text-lg font-semibold tabular-nums">{eur(Number(v.total))}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(v.created_at).toLocaleString("en-GB")} · {v.lead_time_days ?? "—"} {t("rfq.days")}
              {v.delivery_date && ` · ${t("rfq.date")} ${v.delivery_date}`}{v.valid_until && ` · ${t("quote.validUntil")} ${v.valid_until}`}
              {v.payment_terms && ` · ${v.payment_terms}`} · {t("quote.delivery")} {eur(Number(v.delivery_cost))}
            </p>
            <ul className="mt-2 space-y-0.5 text-xs">{((v.lines as { rfq_item_id: string; unit_price: number; quantity: number; line_total: number }[]) ?? []).map((l) => (
              <li key={l.rfq_item_id} className="flex justify-between gap-2"><span className="truncate">{names.get(l.rfq_item_id) ?? "—"}</span>
                <span className="shrink-0 tabular-nums">{Number(l.quantity)} × {eur(Number(l.unit_price))} = {eur(Number(l.line_total))}</span></li>))}</ul>
            {v.message && <p className="mt-2 italic">“{v.message}”</p>}
          </li>);
      })}
    </ol>
  );
}
