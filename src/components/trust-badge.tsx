import { ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { cn } from "@/lib/utils";

type Component = { key: string; points: number; max: number; source: "public" | "platform" };
export type Breakdown = { components?: Component[]; public_points?: number; platform_points?: number;
  platform_neutral?: boolean; completed_orders?: number; status?: string };

export function scoreTone(score: number) {
  return score >= 75 ? "bg-primary text-primary-foreground" : score >= 40 ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground";
}

export function TrustBadge({ score, breakdown, dataDate }: { score: number; breakdown: Breakdown | null; dataDate?: string | null }) {
  const { t } = useI18n();
  const comps = breakdown?.components ?? [];
  const group = (src: Component["source"]) => comps.filter((c) => c.source === src);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("trust.why")}
          className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold", scoreTone(score))}>
          <ShieldCheck className="h-3.5 w-3.5" />{score}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm">
        <p className="font-display font-semibold mb-2">{t("trust.why")}</p>
        {breakdown?.status && breakdown.status !== "active" && breakdown.status !== "unknown" && (
          <p className="mb-2 text-destructive">{t("trust.inactive")}</p>
        )}
        {(["public", "platform"] as const).map((src) => (
          <div key={src} className="mb-3">
            <div className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground mb-1">
              <span>{t(`trust.src.${src}` as TKey)}</span>
              <span>{src === "public" ? breakdown?.public_points : breakdown?.platform_points} / {src === "public" ? 60 : 40}</span>
            </div>
            {src === "platform" && breakdown?.platform_neutral ? (
              <p className="text-muted-foreground">{t("trust.neutral").replace("{n}", String(breakdown.completed_orders ?? 0))}</p>
            ) : (
              <ul className="space-y-0.5">
                {group(src).map((c) => (
                  <li key={c.key} className="flex justify-between">
                    <span>{t(`trust.c.${c.key}` as TKey)}</span>
                    <span className="tabular-nums">{Number(c.points)} / {c.max}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {dataDate && <p className="text-xs text-muted-foreground">{t("trust.dataDate")} {dataDate}</p>}
      </PopoverContent>
    </Popover>
  );
}
