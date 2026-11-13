import { useEffect, useState } from "react";

/** Ticking clock for live countdowns. Re-renders the caller every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

/** Live "time left" text: "2d 4h 12m" → "4h 12m 30s" → "12m 30s" → "0s". */
export function countdownText(to: string | null, now: number): string {
  if (!to) return "—";
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}
