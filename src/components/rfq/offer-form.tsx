import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { offerTotals } from "@/lib/quote";
import { eur } from "@/components/rfq/quote-thread";

export type OfferItem = { id: string; description: string; quantity: number; unit: string | null };
export type VersionLike = {
  lines: unknown; delivery_cost: number | string; lead_time_days: number | null; delivery_date: string | null;
  warehouse_origin?: string | null; valid_until: string | null; payment_terms: string | null;
};
export type Offer = {
  lines: { rfq_item_id: string; unit_price: number }[]; delivery_cost: number; lead_time_days: number | null;
  delivery_date: string; warehouse_origin: string; valid_until: string; payment_terms: string; message: string;
};

export type PriceHint = { name: string; price: number; unit: string | null; updated: string | null };

export function OfferForm({ items, hints, initial, submitLabel, onSubmit, onCancel }: {
  items: OfferItem[]; hints?: Record<string, PriceHint>; initial?: VersionLike | null | undefined; submitLabel: string;
  onSubmit: (o: Offer) => Promise<boolean>; onCancel?: () => void;
}) {
  const { t } = useI18n();
  const prev = new Map(((initial?.lines as { rfq_item_id: string; unit_price: number }[]) ?? []).map((l) => [l.rfq_item_id, l.unit_price]));
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, prev.has(i.id) ? String(prev.get(i.id)) : ""])));
  const [delivery, setDelivery] = useState(String(initial?.delivery_cost ?? "0"));
  const [lead, setLead] = useState(initial?.lead_time_days != null ? String(initial.lead_time_days) : "");
  const [date, setDate] = useState(initial?.delivery_date ?? "");
  const [origin, setOrigin] = useState(initial?.warehouse_origin ?? "");
  const [valid, setValid] = useState(initial?.valid_until ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  const [terms, setTerms] = useState(initial?.payment_terms ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const lines = items.map((i) => ({ rfq_item_id: i.id, unit_price: Number(prices[i.id]), quantity: Number(i.quantity) }));
  const complete = items.every((i) => prices[i.id] !== "" && Number(prices[i.id]) >= 0);
  const totals = offerTotals(complete ? lines : [], Number(delivery));

  async function submit() {
    setBusy(true);
    const ok = await onSubmit({
      lines: lines.map(({ rfq_item_id, unit_price }) => ({ rfq_item_id, unit_price })), delivery_cost: Number(delivery) || 0,
      lead_time_days: lead ? Number(lead) : null, delivery_date: date, warehouse_origin: origin, valid_until: valid, payment_terms: terms, message,
    });
    setBusy(false);
    if (ok) setMessage("");
  }

  return (
    <div className="space-y-4 text-sm">
      <table className="w-full">
        <thead className="text-left text-muted-foreground"><tr><th className="py-1">{t("rfq.itemDescription")}</th><th className="text-right">{t("rfq.quantity")}</th><th className="w-32 text-right">{t("quote.unitPrice")}</th><th className="w-28 text-right">{t("rfq.total")}</th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id} className="border-t">
            <td className="py-2 pr-2">{i.description}
              {hints?.[i.id] && <p className="mt-1 text-xs text-muted-foreground">
                {t("cat.hint")}: {hints[i.id].name} · {eur(hints[i.id].price)}{hints[i.id].unit ? ` / ${hints[i.id].unit}` : ""} · {t("cat.priceUpdated").replace("{d}", hints[i.id].updated ? new Date(hints[i.id].updated!).toLocaleDateString("en-GB") : "—")}{" "}
                <button type="button" className="font-medium text-primary underline" onClick={() => setPrices({ ...prices, [i.id]: String(hints[i.id].price) })}>{t("cat.use")}</button></p>}</td>
            <td className="text-right tabular-nums">{Number(i.quantity)} {i.unit}</td>
            <td className="pl-2"><Input type="number" min={0} step="0.01" inputMode="decimal" aria-label={`${t("quote.unitPrice")} ${i.description}`}
              value={prices[i.id]} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} className="text-right" /></td>
            <td className="text-right tabular-nums">{prices[i.id] !== "" ? eur(Number(prices[i.id]) * Number(i.quantity)) : "—"}</td>
          </tr>))}</tbody>
      </table>
      {hints && Object.keys(hints).length > 0 && <p className="text-xs text-muted-foreground">{t("cat.hintNote")}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1"><span>{t("quote.delivery")}</span><Input type="number" min={0} value={delivery} onChange={(e) => setDelivery(e.target.value)} /></label>
        <label className="space-y-1"><span>{t("rfq.leadTime")} ({t("rfq.days")})</span><Input type="number" min={0} value={lead} onChange={(e) => setLead(e.target.value)} /></label>
        <label className="space-y-1"><span>{t("rfq.date")}</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="space-y-1"><span>{t("quote.origin")}</span><Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Kaunas, LT" /></label>
        <label className="space-y-1"><span>{t("quote.validUntil")}</span><Input type="date" value={valid} onChange={(e) => setValid(e.target.value)} /></label>
        <label className="space-y-1"><span>{t("quote.terms")}</span><Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t("quote.termsPh")} /></label>
      </div>
      <label className="block space-y-1"><span>{t("inbox.message")}</span><Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-3">
        <span>{t("quote.subtotal")} {eur(totals.subtotal)} · <strong>{t("rfq.total")} {eur(totals.total)}</strong></span>
        <div className="flex gap-2">
          {onCancel && <Button variant="ghost" onClick={onCancel}>{t("quote.cancel")}</Button>}
          <Button onClick={submit} disabled={busy || !complete}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}
