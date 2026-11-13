import { countdownText, useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

/** Live ticking countdown to a timestamp, updating every second. */
export function Countdown({ to, className }: { to: string | null; className?: string }) {
  const now = useNow(1000);
  return <span className={cn("tabular-nums", className)}>{countdownText(to, now)}</span>;
}
