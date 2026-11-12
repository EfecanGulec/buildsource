import { createFileRoute, redirect } from "@tanstack/react-router";
import { accountQuery } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";

// Sends each signed-in user to their own area.
export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    const account = await context.queryClient.ensureQueryData(accountQuery);
    if (account) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", account.user.id);
      if (roles?.some((r) => r.role === "admin")) throw redirect({ to: "/admin" });
    }
    if (!account?.role || !account.profile?.company_name || !account.profile?.city) {
      throw redirect({ to: "/onboarding" });
    }
    throw redirect({ to: account.role === "supplier" ? "/supplier" : "/app" });
  },
});
