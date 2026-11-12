// Demo logins from spec §11 (plus an admin login to reach the Reset button). Shared password for all.
export const DEMO_PASSWORD = "BuildSource-Demo-2026";
export const DEMO_ACCOUNTS = [
  { email: "buyer@demo.lt", role: "buyer", company: "Tomas Renovacija UAB" },
  { email: "designer@demo.lt", role: "buyer", company: "Studija Erdvė" },
  { email: "cafe@demo.lt", role: "buyer", company: "Kavinė Laisvė" },
  { email: "supplier@demo.lt", role: "supplier", company: "Baltic Insulation UAB" },
  { email: "furniture@demo.lt", role: "supplier", company: "Ąžuolas Furniture UAB" },
  { email: "admin@demo.lt", role: "admin", company: "BuildSource LT" },
] as const;
