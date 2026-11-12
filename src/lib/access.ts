export type Destination = "/onboarding" | "/verify" | "/app" | "/supplier" | "/admin";

export type AccessInput = {
  roles: string[];
  hasCompany: boolean;
  smartIdVerified: boolean;
};

/** Where a signed-in user belongs. Admins skip company + Smart-ID setup. */
export function homeFor(a: AccessInput): Destination {
  if (a.roles.includes("admin")) return "/admin";
  const role = a.roles.find((r) => r === "buyer" || r === "supplier");
  if (!role || !a.hasCompany) return "/onboarding";
  if (!a.smartIdVerified) return "/verify";
  return role === "supplier" ? "/supplier" : "/app";
}
