import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SERVICES, canGoLive, type Service } from "./connectors/services";
import { getConnector } from "./connectors/connectors";

const svc = z.enum(Object.keys(SERVICES) as [Service, ...Service[]]);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

/** Which services have their secrets set (names only, never values). */
export const integrationReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const has = (n: string) => !!process.env[n];
    return Object.fromEntries((Object.keys(SERVICES) as Service[]).map((s) => [s, canGoLive(s, has)])) as Record<Service, boolean>;
  });

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ service: svc }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("integrations").select("provider, mode").eq("service", data.service).single();
    const mode = (row?.mode ?? "demo") as "demo" | "live";
    const t0 = Date.now();
    let r: { ok: boolean; message: string };
    try { r = await getConnector(data.service, mode).test(); } catch (e) { r = { ok: false, message: e instanceof Error ? e.message : String(e) }; }
    await supabaseAdmin.from("integration_logs").insert({ service: data.service, provider: row?.provider ?? null, action: "test_connection",
      request_summary: { mode }, response_status: r.ok ? 200 : 500, duration_ms: Date.now() - t0, error: r.ok ? null : r.message });
    await supabaseAdmin.from("integrations").update(r.ok ? { last_success_at: new Date().toISOString(), last_error: null } : { last_error: r.message }).eq("service", data.service);
    return r;
  });

export const setIntegrationMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ service: svc, mode: z.enum(["demo", "live"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.mode === "live" && !canGoLive(data.service, (n) => !!process.env[n]))
      throw new Error(`Add the ${SERVICES[data.service].secrets.join(", ")} secret(s) before switching to live`);
    const { error } = await context.supabase.rpc("admin_set_integration", { _service: data.service, _mode: data.mode, _enabled: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
