import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Copy, Database, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/rfq/status-badge";
import { supabase } from "@/integrations/supabase/client";
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
  const sim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_simulate_48h");
      if (error) throw error;
      return data as { reminders: number; rerouted: number };
    },
    onSuccess: (r) => { toast.success(t("demo.simulated").replace("{r}", String(r.reminders)).replace("{x}", String(r.rerouted))); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const links = useQuery({
    queryKey: ["magic-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rfq_recipients")
        .select("id,status,magic_token,companies(name),rfqs(rfq_number)").not("magic_token", "is", null).in("status", ["sent", "viewed"]);
      if (error) throw error;
      return data;
    },
  });
  const copy = (token: string) => { navigator.clipboard.writeText(`${window.location.origin}/q/${token}`); toast.success(t("magic.copied")); };
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-semibold">{t("nav.demoData")}</h1>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-muted-foreground">{t("demo.intro")}</p>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          <RotateCcw className="mr-2 h-4 w-4" />{m.isPending ? t("demo.resetting") : t("demo.reset")}
        </Button>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <p className="text-muted-foreground">{t("demo.simulateHint")}</p>
        <Button variant="outline" onClick={() => sim.mutate()} disabled={sim.isPending}><Clock className="mr-2 h-4 w-4" />{t("demo.simulate")}</Button>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("magic.links")}</h2>
        <p className="text-sm text-muted-foreground">{t("magic.linksHint")}</p>
        {(links.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("magic.none")}</p> : (
          <table className="w-full text-sm"><tbody>{links.data!.map((l) => (
            <tr key={l.id} className="border-t [&>td]:py-2">
              <td className="font-mono">{l.rfqs?.rfq_number}</td><td>{l.companies?.name}</td>
              <td><StatusBadge kind="recipient" status={l.status} /></td>
              <td className="text-right space-x-1">
                <a href={`/q/${l.magic_token}`} target="_blank" rel="noreferrer" className="text-primary underline">/q/…{l.magic_token!.slice(-6)}</a>
                <Button size="sm" variant="ghost" onClick={() => copy(l.magic_token!)} aria-label={t("magic.copy")}><Copy className="h-4 w-4" /></Button>
              </td></tr>))}</tbody></table>)}
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-display text-lg font-semibold mb-3">{t("demo.logins")}</h2>
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
