import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountType = "buyer" | "supplier";

export const accountQuery = queryOptions({
  queryKey: ["account"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const role = (roles ?? []).find((r) => r.role === "buyer" || r.role === "supplier")?.role as
      | AccountType
      | undefined;
    return { user, profile, role: role ?? null };
  },
});

export function useAccount() {
  return useQuery(accountQuery);
}
