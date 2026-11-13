import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseVat, viesUrl } from "./vies";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

/** Admin: live EU VIES VAT check (public API, no key), saved to company_public_data, then Trust Score recompute. */
export const checkCompanyVat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c, error } = await supabaseAdmin.from("companies").select("id, vat_code, country").eq("id", data.companyId).single();
    if (error || !c) throw new Error("Company not found");
    const v = parseVat(c.vat_code, c.country ?? "LT");
    if (!v) return { ok: false as const, message: "No valid EU VAT code saved for this company" };
    const t0 = Date.now();
    const res = await fetch(viesUrl(v.cc, v.number), { headers: { Accept: "application/json" } });
    const body = await res.text();
    await supabaseAdmin.from("integration_logs").insert({ service: "company_data", provider: "vies", action: "check_vat",
      request_summary: { cc: v.cc }, response_status: res.status, duration_ms: Date.now() - t0, error: res.ok ? null : body.slice(0, 300) });
    if (!res.ok) return { ok: false as const, message: `VAT service unavailable (${res.status}). Try again later.` };
    const j = JSON.parse(body) as { isValid?: boolean; name?: string; address?: string; userError?: string };
    if (j.userError && !["VALID", "INVALID"].includes(j.userError))
      return { ok: false as const, message: `VAT service busy (${j.userError}). Try again later.` };
    const valid = !!j.isValid;
    const today = new Date().toISOString().slice(0, 10);
    const { error: upErr } = await supabaseAdmin.from("company_public_data")
      .upsert({ company_id: c.id, vat_valid: valid, data_date: today }, { onConflict: "company_id" });
    if (upErr) throw new Error(upErr.message);
    await supabaseAdmin.rpc("compute_trust_score", { _company: c.id });
    const clean = (s?: string) => (s && s !== "---" ? s.trim() : undefined);
    return { ok: true as const, valid, name: clean(j.name), address: clean(j.address) };
  });

/** Admin: set the email unclaimed suppliers receive RFQ links at. */
export const setCompanyContactEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), email: z.string().trim().email().max(255).or(z.literal("")) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("companies").update({ contact_email: data.email || null }).eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
