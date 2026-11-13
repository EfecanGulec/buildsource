import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function Stat({ label, value, to, hint }: { label: string; value: ReactNode; to?: string; hint?: string }) {
  const body = (<>
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </>);
  return to
    ? <Link to={to} className="block rounded-lg border bg-card p-5 hover:border-primary">{body}</Link>
    : <div className="rounded-lg border bg-card p-5">{body}</div>;
}
export function StatSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div>;
}
