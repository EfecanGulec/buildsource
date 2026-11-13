import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SERVICES, type Service } from "@/lib/connectors/services";
import { integrationReadiness, sendPendingEmails, setIntegrationMode, testIntegration } from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({ meta: [
    { title: "Integrations — BuildSource LT admin" },
    { name: "description", content: "Demo and live modes for every external service on BuildSource LT." },
    { property: "og:title", content: "Integrations — BuildSource LT admin" },
    { property: "og:description", content: "Demo and live modes for every external service." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Integrations,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");

function Integrations() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ready = useServerFn(integrationReadiness);
  const test = useServerFn(testIntegration);
  const setMode = useServerFn(setIntegrationMode);
  const sendEmails = useServerFn(sendPendingEmails);
  const emailM = useMutation({ mutationFn: () => sendEmails(),
    onSuccess: (r) => toast.success(t("int.emailsSent") + " " + (Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ") || "0")),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)) });
  const rows = useQuery({ queryKey: ["integrations"], queryFn: async () => {
    const { data, error } = await supabase.from("integrations").select("*").order("service");
    if (error) throw error; return data;
  } });
  const rd = useQuery({ queryKey: ["integration-ready"], queryFn: () => ready() });
  const jobs = useQuery({ queryKey: ["sync-jobs"], queryFn: async () => {
    const { data, error } = await supabase.from("sync_jobs").select("id, job, status, attempts, run_after, created_at").order("created_at", { ascending: false }).limit(10);
    if (error) throw error; return data;
  } });
  const done = () => qc.invalidateQueries({ queryKey: ["integrations"] });
  const testM = useMutation({ mutationFn: (s: Service) => test({ data: { service: s } }),
    onSuccess: (r) => { r.ok ? toast.success(r.message) : toast.error(r.message); done(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)) });
  const modeM = useMutation({ mutationFn: (v: { service: Service; mode: "demo" | "live" }) => setMode({ data: v }),
    onSuccess: done, onError: (e) => toast.error(e instanceof Error ? e.message : String(e)) });
  const runJobs = useMutation({ mutationFn: async () => {
    for (const j of ["pool_close", "rfq_timeouts", "quote_expiry"]) await supabase.rpc("enqueue_job", { _job: j });
    const { data, error } = await supabase.rpc("run_sync_jobs"); if (error) throw error; return data;
  }, onSuccess: (n) => { toast.success(t("int.ran").replace("{n}", String(n))); qc.invalidateQueries({ queryKey: ["sync-jobs"] }); } });

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t("nav.integrations")}</h1>
        <p className="text-sm text-muted-foreground">{t("int.intro")}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">{t("int.service")}</th><th className="p-3">{t("int.provider")}</th><th className="p-3">{t("int.status")}</th>
              <th className="p-3">{t("int.lastOk")}</th><th className="p-3">{t("int.lastError")}</th><th className="p-3">{t("int.live")}</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.data?.map((r) => {
              const s = r.service as Service; const meta = SERVICES[s]; const canLive = rd.data?.[s];
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3"><div className="font-medium">{meta?.label ?? s}</div>
                    <div className="text-xs text-muted-foreground">{r.mode === "demo" ? meta?.demo : t("int.realProvider")}</div></td>
                  <td className="p-3 font-mono text-xs">{r.provider}</td>
                  <td className="p-3"><Badge variant={r.mode === "live" ? "default" : "secondary"}>{r.mode === "live" ? t("int.modeLive") : t("int.modeDemo")}</Badge>
                    {!canLive && rd.data && <div className="mt-1 text-xs text-muted-foreground">{t("int.needs")} {meta.secrets.join(", ")}</div>}</td>
                  <td className="p-3 text-xs">{fmt(r.last_success_at)}</td>
                  <td className="p-3 text-xs text-destructive">{r.last_error ?? "—"}</td>
                  <td className="p-3"><Switch checked={r.mode === "live"} disabled={modeM.isPending || (r.mode === "demo" && !canLive)}
                    aria-label={`${meta?.label} live`} onCheckedChange={(v) => modeM.mutate({ service: s, mode: v ? "live" : "demo" })} /></td>
                  <td className="p-3"><Button size="sm" variant="outline" disabled={testM.isPending} onClick={() => testM.mutate(s)}>{t("int.test")}</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-display font-semibold">{t("int.jobs")}</h2><p className="text-xs text-muted-foreground">{t("int.jobsHint")}</p></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => emailM.mutate()} disabled={emailM.isPending}>{t("int.sendEmails")}</Button>
            <Button size="sm" onClick={() => runJobs.mutate()} disabled={runJobs.isPending}>{t("int.runNow")}</Button>
          </div>
        </div>
        <ul className="divide-y text-sm">
          {jobs.data?.length === 0 && <li className="py-2 text-muted-foreground">{t("int.noJobs")}</li>}
          {jobs.data?.map((j) => (
            <li key={j.id} className="flex justify-between py-2"><span className="font-mono text-xs">{j.job}</span>
              <span className="text-xs text-muted-foreground">{j.status} · {j.attempts}× · {fmt(j.created_at)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
