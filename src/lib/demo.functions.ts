import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demo-accounts";

// Admin-only: makes sure every demo login exists, then reloads all demo data.
export const resetDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("profiles").select("email").in("email", DEMO_ACCOUNTS.map((a) => a.email));
    const have = new Set((existing ?? []).map((p) => p.email));
    for (const a of DEMO_ACCOUNTS) {
      if (have.has(a.email)) continue;
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: a.email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: a.role === "admin" ? {} : { account_type: a.role },
      });
      if (error) throw new Error(`Could not create ${a.email}: ${error.message}`);
    }
    const { data, error } = await supabaseAdmin.rpc("reset_demo_data");
    if (error) throw new Error(error.message);
    return data as { companies: number };
  });
