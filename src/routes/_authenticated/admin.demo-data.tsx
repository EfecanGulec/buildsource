import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resetDemoData } from "@/lib/demo.functions";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/demo-data")({
  head: () => ({ meta: [{ title: "Demo data — BuildSource LT" }] }),
  component: DemoData,
});

function DemoData() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const reset = useServerFn(resetDemoData);
  const m = useMutation({
    mutationFn: () => reset(),
    onSuccess: (r) => { toast.success(t("demo.done").replace("{n}", String(r.companies))); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-2xl font-semibold">{t("nav.demoData")}</h1>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-muted-foreground">{t("demo.intro")}</p>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          <RotateCcw className="mr-2 h-4 w-4" />{m.isPending ? t("demo.resetting") : t("demo.reset")}
        </Button>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold mb-3">{t("demo.logins")}</h2>
        <table className="w-full text-sm">
          <tbody>
            {DEMO_ACCOUNTS.map((a) => (
              <tr key={a.email} className="border-t">
                <td className="py-2 font-mono">{a.email}</td>
                <td className="py-2 capitalize">{a.role}</td>
                <td className="py-2 text-muted-foreground">{a.company}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-muted-foreground">{t("demo.password")} <span className="font-mono">{DEMO_PASSWORD}</span></p>
      </div>
    </div>
  );
}
