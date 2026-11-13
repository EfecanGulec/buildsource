import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Stat, StatSkeleton } from "@/components/dashboard/stat";
import { StatusBadge } from "@/components/rfq/status-badge";
import { QueryState } from "@/components/query-state";
import { eur } from "@/components/rfq/quote-thread";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type Party = { name: string; company_code?: string; vat_code?: string | null; address?: string | null; city?: string | null; country?: string | null };
type Detail = {
  order_number: string; created_at: string; status: string; payment_method: string; buyer: Party; supplier: Party;
  lines: { name: string; unit: string | null; quantity: number; unit_price: number; line_total: number }[];
  subtotal: number; delivery_cost: number; total: number;
  commission_rate: number | null; commission_amount: number | null; supplier_payout: number | null;
};

export function InvoicesPage({ side }: { side: "buyer" | "supplier" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["invoices"], queryFn: async () => {
    const { data, error } = await supabase.rpc("my_invoices");
    if (error) throw error;
    return data.filter((r) => r.side === side);
  } });
  const rows = q.data ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  return (
    <div className="max-w-5xl space-y-6">
      <div><h1 className="font-display text-2xl font-semibold">{t("nav.invoices")}</h1>
        <p className="text-sm text-muted-foreground">{t(side === "buyer" ? "inv.helpBuyer" : "inv.helpSupplier")}</p></div>
      {q.isPending ? <StatSkeleton /> : q.isError ? <QueryState isLoading={q.isPending} error={q.error} onRetry={() => q.refetch()} /> : (<>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("inv.count")} value={String(rows.length)} />
          <Stat label={t(side === "buyer" ? "inv.spent" : "earn.sales")} value={eur(sum((r) => Number(r.total)))} />
          {side === "supplier"
            ? <Stat label={t("earn.commission")} value={eur(sum((r) => Number(r.commission_amount ?? 0)))} />
            : <Stat label={t("inv.unpaid")} value={eur(sum((r) => (r.paid ? 0 : Number(r.total))))} />}
        </div>
        {rows.length === 0 ? <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("inv.empty")}</p> : (
          <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-4 [&>th]:py-3">
              <th>{t("inv.number")}</th><th>{t("inv.date")}</th><th>{t("ord.counterparty")}</th><th>{t("rfq.status")}</th>
              <th className="text-right">{t("rfq.total")}</th>
              {side === "supplier" && <><th className="text-right">{t("earn.commission")}</th><th className="text-right">{t("agr.payout")}</th></>}
              <th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.order_id} className="border-t [&>td]:px-4 [&>td]:py-3">
                <td><span className="font-mono">INV-{r.order_number.replace(/^ORD-/, "")}</span><div className="text-xs text-muted-foreground">{r.title}</div></td>
                <td className="tabular-nums">{new Date(r.created_at).toLocaleDateString()}</td>
                <td>{r.counterparty}</td>
                <td><StatusBadge kind="order" status={r.status} /><div className="text-xs text-muted-foreground">{r.paid ? t("inv.paid") : t("inv.notPaid")}</div></td>
                <td className="text-right tabular-nums">{eur(Number(r.total))}</td>
                {side === "supplier" && <><td className="text-right tabular-nums text-muted-foreground">−{eur(Number(r.commission_amount ?? 0))}</td>
                  <td className="text-right tabular-nums font-medium">{eur(Number(r.supplier_payout ?? 0))}</td></>}
                <td className="text-right"><Button size="sm" variant="outline" onClick={() => setOpen(r.order_id)}>{t("inv.view")}</Button></td>
              </tr>))}</tbody>
          </table></div>)}
      </>)}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl print:max-h-none print:shadow-none">
          {open && <InvoiceDetail orderId={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartyBlock({ label, p }: { label: string; p: Party }) {
  const { t } = useI18n();
  return <div className="space-y-0.5 text-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-semibold">{p.name}</p>
    {p.company_code && <p>{t("inv.companyCode")}: {p.company_code}</p>}
    {p.vat_code && <p>{t("inv.vat")}: {p.vat_code}</p>}
    {(p.address || p.city) && <p>{[p.address, p.city, p.country].filter(Boolean).join(", ")}</p>}
  </div>;
}

function InvoiceDetail({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["invoice", orderId], queryFn: async () => {
    const { data, error } = await supabase.rpc("invoice_detail", { _order: orderId });
    if (error) throw error;
    return data as unknown as Detail;
  } });
  if (q.isPending || q.isError) return <><DialogHeader><DialogTitle>{t("inv.invoice")}</DialogTitle><DialogDescription className="sr-only">{t("inv.invoice")}</DialogDescription></DialogHeader><QueryState isLoading={q.isPending} error={q.error} onRetry={() => q.refetch()} /></>;
  const d = q.data;
  return <div id="invoice-print" className="space-y-5">
    <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0">
      <div><DialogTitle>{t("inv.invoice")} INV-{d.order_number.replace(/^ORD-/, "")}</DialogTitle>
        <DialogDescription>{t("inv.date")}: {new Date(d.created_at).toLocaleDateString()} · {t("ord.number")}: {d.order_number}</DialogDescription></div>
      <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}><Printer className="size-4" />{t("inv.print")}</Button>
    </DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2"><PartyBlock label={t("inv.seller")} p={d.supplier} /><PartyBlock label={t("inv.billedTo")} p={d.buyer} /></div>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
      <thead className="text-left text-muted-foreground"><tr className="[&>th]:px-3 [&>th]:py-2"><th>{t("inv.item")}</th><th className="text-right">{t("inv.qty")}</th><th className="text-right">{t("inv.unitPrice")}</th><th className="text-right">{t("rfq.total")}</th></tr></thead>
      <tbody>{d.lines.map((l, i) => <tr key={i} className="border-t [&>td]:px-3 [&>td]:py-2"><td>{l.name}</td><td className="text-right tabular-nums">{l.quantity} {l.unit ?? ""}</td><td className="text-right tabular-nums">{eur(Number(l.unit_price))}</td><td className="text-right tabular-nums">{eur(Number(l.line_total))}</td></tr>)}</tbody>
    </table></div>
    <dl className="ml-auto max-w-xs space-y-1 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-6">
      <div><dt>{t("inv.subtotal")}</dt><dd className="tabular-nums">{eur(Number(d.subtotal))}</dd></div>
      <div><dt>{t("inv.delivery")}</dt><dd className="tabular-nums">{eur(Number(d.delivery_cost))}</dd></div>
      <div className="border-t pt-1 font-semibold"><dt>{t("rfq.total")}</dt><dd className="tabular-nums">{eur(Number(d.total))}</dd></div>
      {d.commission_amount != null && <>
        <div className="text-muted-foreground"><dt>{t("earn.commission")} ({(Number(d.commission_rate) * 100).toFixed(1)}%)</dt><dd className="tabular-nums">−{eur(Number(d.commission_amount))}</dd></div>
        <div className="font-medium"><dt>{t("agr.payout")}</dt><dd className="tabular-nums">{eur(Number(d.supplier_payout))}</dd></div>
      </>}
    </dl>
    <p className="text-xs text-muted-foreground">{t("inv.payment")}: {d.payment_method.replace(/_/g, " ")}</p>
  </div>;
}
