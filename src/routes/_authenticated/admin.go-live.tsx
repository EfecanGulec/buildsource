import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";
import { SERVICES, type Service } from "@/lib/connectors/services";
import { integrationReadiness } from "@/lib/integrations.functions";
import { GO_LIVE_TASKS, LIVE_TESTS, serviceStatus } from "@/lib/go-live";

export const Route = createFileRoute("/_authenticated/admin/go-live")({
  head: () => ({ meta: [{ title: "Go-live status — BuildSource LT admin" }, { name: "description", content: "Launch checklist and live service status." }] }),
  component: GoLive,
});

const KEY = "bs-go-live-ticks";
const tone: Record<string, "default" | "secondary" | "destructive" | "outline"> = { live_ok: "default", untested: "outline", error: "destructive", ready_to_switch: "secondary", needs_secrets: "outline" };

function GoLive() {
  const { t } = useI18n();
  const ready = useServerFn(integrationReadiness);
  const rows = useQuery({ queryKey: ["integrations"], queryFn: async () => {
    const { data, error } = await supabase.from("integrations").select("*").order("service"); if (error) throw error; return data;
  } });
  const rd = useQuery({ queryKey: ["integration-ready"], queryFn: () => ready() });
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setTicks(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { /* ignore */ } }, []);
  const toggle = (k: string, v: boolean) => { const n = { ...ticks, [k]: v }; setTicks(n); localStorage.setItem(KEY, JSON.stringify(n)); };
  const done = GO_LIVE_TASKS.filter((k) => ticks[k]).length;
  const liveMode = new Map((rows.data ?? []).map((r) => [r.service, r.mode]));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3"><Rocket className="h-6 w-6 text-primary" /><h1 className="font-display text-2xl font-semibold">{t("nav.goLive")}</h1></div>
      <p className="text-muted-foreground">{t("gl.intro")}</p>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("gl.services")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.data?.map((r) => {
            const s = r.service as Service; const st = serviceStatus(r, !!rd.data?.[s]);
            return (
              <div key={r.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2"><span className="font-medium">{SERVICES[s]?.label ?? s}</span>
                  <Badge variant={tone[st]}>{t(`gl.st.${st}` as TKey)}</Badge></div>
                {st === "needs_secrets" && SERVICES[s].secrets.length > 0 && <p className="text-xs text-muted-foreground">{t("int.needs")} {SERVICES[s].secrets.join(", ")}</p>}
                {r.last_error && <p className="text-xs text-destructive">{r.last_error}</p>}
              </div>
            );
          })}
        </div>
        <Link to="/admin/integrations" className="text-sm text-primary underline">{t("gl.openIntegrations")}</Link>
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-3">
        <div className="flex justify-between"><h2 className="font-display text-lg font-semibold">{t("gl.checklist")}</h2><span className="text-sm text-muted-foreground">{done}/{GO_LIVE_TASKS.length}</span></div>
        <ul className="space-y-2">{GO_LIVE_TASKS.map((k, i) => (
          <li key={k}><label className="flex items-start gap-3 text-sm"><Checkbox checked={!!ticks[k]} onCheckedChange={(v) => toggle(k, v === true)} className="mt-0.5" />
            <span className={ticks[k] ? "line-through text-muted-foreground" : ""}>{i + 1}. {t(k as TKey)}</span></label></li>
        ))}</ul>
        <p className="text-xs text-muted-foreground">{t("gl.savedHere")}</p>
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("gl.tests")}</h2>
        <p className="text-sm text-muted-foreground">{t("gl.testsHint")}</p>
        <ul className="divide-y">{LIVE_TESTS.map((tc) => { const k = `tc.${tc.id}`; const live = liveMode.get(tc.service) === "live"; return (
          <li key={tc.id} className="py-2"><label className="flex items-start gap-3 text-sm">
            <Checkbox disabled={!live} checked={!!ticks[k]} onCheckedChange={(v) => toggle(k, v === true)} className="mt-0.5" />
            <span className="flex-1"><span className="font-mono text-xs mr-2">{tc.id}</span>{t(`gl.${tc.id}` as TKey)}</span>
            {!live && <Badge variant="outline">{t("gl.waitsLive")}</Badge>}</label></li>); })}</ul>
      </section>
    </div>
  );
}
