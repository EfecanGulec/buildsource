import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Loading / error box so a page never sits empty while its data loads or fails. */
export function QueryState({ isLoading, error, onRetry }: { isLoading: boolean; error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 rounded-lg border bg-card p-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />{t("qs.loading")}
    </div>
  );
  if (!error) return null;
  return (
    <div className="rounded-lg border border-destructive/40 bg-card p-6 text-sm space-y-3" role="alert">
      <p className="font-medium">{t("qs.error")}</p>
      <p className="text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-2 h-3 w-3" />{t("qs.retry")}</Button>
    </div>
  );
}
