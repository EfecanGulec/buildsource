import { describe, expect, it } from "vitest";
import { homeFor } from "./access";

const ready = { hasCompany: true, smartIdVerified: true };
describe("homeFor", () => {
  it("sends buyers to /app", () => expect(homeFor({ roles: ["buyer"], ...ready })).toBe("/app"));
  it("sends suppliers to /supplier", () => expect(homeFor({ roles: ["supplier"], ...ready })).toBe("/supplier"));
  it("sends admins to /admin", () => expect(homeFor({ roles: ["admin"], hasCompany: false, smartIdVerified: false })).toBe("/admin"));
  it("requires company details first", () => expect(homeFor({ roles: ["buyer"], hasCompany: false, smartIdVerified: true })).toBe("/onboarding"));
  it("requires a role first", () => expect(homeFor({ roles: [], ...ready })).toBe("/onboarding"));
  it("requires Smart-ID verification", () => expect(homeFor({ roles: ["supplier"], hasCompany: true, smartIdVerified: false })).toBe("/verify"));
});
