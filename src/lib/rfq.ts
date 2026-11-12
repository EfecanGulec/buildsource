// Shared RFQ helpers (spec §5.2, §8).
export type FieldDef = { key: string; label: string; type: "select" | "text" | "number" | "bool"; options?: string[]; placeholder?: string };

/** ISO week like "2026-W48" for a yyyy-mm-dd date. */
export function isoWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Kit quantity formulas like "seats/4" or "facade_m2*1.05" evaluated with the given variables; plain numbers pass through. */
export function kitQuantity(formula: string, vars: Record<string, number>): number {
  const expr = formula.replace(/[a-z_][a-z0-9_]*/gi, (v) => String(vars[v] ?? 0));
  if (!/^[\d.+\-*/() ]+$/.test(expr)) return 1;
  // eslint-disable-next-line no-new-func
  const n = Number(Function(`"use strict";return (${expr})`)());
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 1;
}

export const RFQ_STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-accent text-accent-foreground",
  matched: "bg-accent text-accent-foreground",
  quotes_received: "bg-primary/15 text-primary",
  negotiating: "bg-primary/15 text-primary",
  closed: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};
