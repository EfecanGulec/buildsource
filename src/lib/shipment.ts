/** Delivery rules mirrored from SQL (_shipment_event, driver_deliver). */
export type ShipMethod = "supplier_own" | "carrier" | "pickup" | "pool_consolidated";
export type ShipStatus = "planned" | "ready_for_pickup" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed";
export type ShipLine = { key: string; name: string; unit: string | null; quantity: number };

export const METHODS: ShipMethod[] = ["supplier_own", "carrier", "pickup", "pool_consolidated"];
const RANK: ShipStatus[] = ["planned", "ready_for_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered"];

/** Statuses the supplier may set next. Pickup ends with the buyer confirming collection. */
export function supplierNext(method: ShipMethod, status: ShipStatus): ShipStatus[] {
  if (status === "delivered") return [];
  if (method === "pickup") return status === "planned" ? ["ready_for_pickup"] : [];
  const steps: ShipStatus[] = method === "carrier" ? ["in_transit", "out_for_delivery", "delivered"] : ["picked_up", "in_transit", "out_for_delivery", "delivered"];
  const at = status === "failed" ? 0 : RANK.indexOf(status);
  return [...steps.filter((s) => RANK.indexOf(s) > at), "failed"];
}

/** What the driver page offers: a status button, or the delivered form. */
export function driverNext(status: ShipStatus): ShipStatus | "deliver" | null {
  if (status === "planned" || status === "ready_for_pickup") return "picked_up";
  if (status === "picked_up" || status === "failed") return "in_transit";
  if (status === "in_transit" || status === "out_for_delivery") return "deliver";
  return null;
}

/** True when any received quantity differs from what the shipment carried. */
export function podMismatch(lines: ShipLine[], received: Record<string, number>) {
  return lines.some((l) => received[l.key] !== Number(l.quantity));
}

export function mismatchSummary(lines: ShipLine[], received: { key: string; received: number }[]) {
  return lines.flatMap((l) => {
    const got = received.find((r) => r.key === l.key)?.received;
    return got !== undefined && got !== Number(l.quantity) ? [`${l.name}: ${got} of ${l.quantity}${l.unit ? " " + l.unit : ""}`] : [];
  }).join("; ");
}

export function isLate(planned: string | null, status: ShipStatus, today = new Date().toISOString().slice(0, 10)) {
  return !!planned && status !== "delivered" && planned < today;
}
