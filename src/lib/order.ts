// Order rules mirrored from SQL (supplier_update_order, buyer_pay_order) for the UI.
export const SUPPLIER_FLOW = ["paid_escrow", "processing", "shipped", "in_transit", "delivered"] as const;
export const TIMELINE = ["awaiting_payment", "paid_escrow", "processing", "shipped", "in_transit", "delivered", "completed"] as const;

/** Statuses the supplier may move to next (forward only, after payment). */
export function nextSupplierStatuses(status: string): string[] {
  const i = SUPPLIER_FLOW.indexOf(status as (typeof SUPPLIER_FLOW)[number]);
  return i < 0 ? [] : SUPPLIER_FLOW.slice(i + 1);
}
/** Custom furniture: 30% at drawing approval, 70% at delivery. */
export function stagedSplit(total: number) {
  const first = Math.round(total * 0.3 * 100) / 100;
  return { first, second: Math.round((total - first) * 100) / 100 };
}
export const PAY_LATER_LIMIT = 20000;
export const canPayLater = (total: number) => total <= PAY_LATER_LIMIT;
export const canDispute = (status: string) => ["shipped", "in_transit", "delivered"].includes(status);
