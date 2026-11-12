import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { homeFor } from "@/lib/access";

export type AccountType = "buyer" | "supplier";

export const accountQuery = queryOptions({
  queryKey: ["account"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const { data: company } = profile?.company_id
      ? await supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle()
      : { data: null };
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const role = roles.find((r) => r === "buyer" || r === "supplier") as AccountType | undefined;
    const home = homeFor({ roles, hasCompany: !!company, smartIdVerified: !!profile?.smart_id_verified });
    return { user, profile, company, roles, role: role ?? null, isAdmin: roles.includes("admin"), home };
  },
});

export function useAccount() {
  return useQuery(accountQuery);
}

/** Route guard: keeps each user inside their own area. */
export async function requireHome(queryClient: QueryClient, path: string) {
  const account = await queryClient.ensureQueryData(accountQuery);
  if (!account) throw redirect({ to: "/auth", search: { mode: "signin" } });
  if (account.home !== path) throw redirect({ to: account.home });
  return account;
}
