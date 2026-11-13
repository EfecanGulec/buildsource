// Group Buy rules (spec 7.7), mirrored from SQL pool_tier_discount / _close_pool / _finalize_pool.
export type Tier = { min_qty: number; discount_pct: number };

export function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => a.min_qty - b.min_qty);
}

export function tierDiscount(tiers: Tier[], qty: number): number {
  return sortTiers(tiers).filter((t) => t.min_qty <= qty).reduce((m, t) => Math.max(m, t.discount_pct), 0);
}

export function unitPrice(base: number, discountPct: number): number {
  return Math.round(base * (1 - discountPct / 100) * 100) / 100;
}

/** Progress toward the next tier: "X more → −Y%". */
export function tierProgress(tiers: Tier[], qty: number) {
  const sorted = sortTiers(tiers);
  const next = sorted.find((t) => t.min_qty > qty) ?? null;
  const top = sorted.at(-1)?.min_qty ?? 0;
  return {
    current: tierDiscount(tiers, qty),
    next: next ? { more: next.min_qty - qty, pct: next.discount_pct } : null,
    pct: top > 0 ? Math.min(100, (qty / top) * 100) : 0,
  };
}

/** At close: below min → cancelled; else confirming at the tier for the total. */
export function closeOutcome(minQty: number, tiers: Tier[], qty: number) {
  return qty < minQty ? { status: "cancelled" as const } : { status: "confirming" as const, discount: tierDiscount(tiers, qty) };
}

/** After the window: keep the tier if ≥ threshold of closed qty confirmed, else recalc on confirmed qty. */
export function finalDiscount(tiers: Tier[], closedQty: number, confirmedQty: number, keepThreshold = 0.8, closedDiscount = tierDiscount(tiers, closedQty)) {
  return confirmedQty >= keepThreshold * closedQty ? closedDiscount : tierDiscount(tiers, confirmedQty);
}

export function validTiers(tiers: Tier[]): boolean {
  const s = sortTiers(tiers);
  return s.length > 0 && s.every((t, i) => t.min_qty > 0 && t.discount_pct > 0 && t.discount_pct < 100 &&
    (i === 0 || (t.min_qty > s[i - 1]!.min_qty && t.discount_pct > s[i - 1]!.discount_pct)));
}

