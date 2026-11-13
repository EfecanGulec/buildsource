// Pure quote/negotiation rules shared by buyer, supplier and magic-link pages (spec 7.3).
// The database enforces the same rules in its RPCs; this mirrors them for the UI.
export type Party = "buyer" | "supplier";
export type OfferLine = { rfq_item_id: string; unit_price: number; quantity: number };

export function offerTotals(lines: OfferLine[], deliveryCost: number) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.unit_price * l.quantity * 100) / 100, 0);
  const delivery = Math.max(0, deliveryCost || 0);
  return { subtotal: Math.round(subtotal * 100) / 100, total: Math.round((subtotal + delivery) * 100) / 100 };
}

export type ThreadState = { status: string; lastParty: Party | null; roundCount: number; roundLimit: number };

export function nextActions(s: ThreadState) {
  const open = s.status === "sent" || s.status === "negotiating";
  const supplierTurn = open && s.lastParty === "buyer";
  const buyerTurn = open && s.lastParty === "supplier";
  return {
    buyerCounter: buyerTurn && s.roundCount < s.roundLimit,
    buyerReject: open,
    buyerAccept: buyerTurn,
    supplierAcceptCounter: supplierTurn,
    roundLimitReached: buyerTurn && s.roundCount >= s.roundLimit,
    supplierRevise: supplierTurn,
    supplierReject: supplierTurn,
  };
}

/** Labels for the comparison page: lowest total = best value, shortest lead time = fastest. */
export function compareLabels(rows: { id: string; total: number; leadDays: number | null }[]) {
  const best = rows.length ? rows.reduce((a, b) => (b.total < a.total ? b : a)).id : null;
  const withLead = rows.filter((r) => r.leadDays != null);
  const fastest = withLead.length ? withLead.reduce((a, b) => (b.leadDays! < a.leadDays! ? b : a)).id : null;
  return { best, fastest };
}
