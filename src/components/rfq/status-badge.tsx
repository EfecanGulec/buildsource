import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { RFQ_STATUS_TONE } from "@/lib/rfq";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, kind = "rfq" }: { status: string; kind?: "rfq" | "recipient" | "quote" }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", RFQ_STATUS_TONE[status] ?? "bg-muted text-muted-foreground")}>
      {t(`status.${kind}.${status}` as TKey)}
    </span>
  );
}
