import { describe, expect, it } from "vitest";
import { deliveryDetailsSchema, needsDeliveryDetails } from "./delivery-details";

const details = { city: "Vilnius", address: "Test street 12", contact: "Site manager", phone: "+37060000000", unloading: "manual", window: "any", access: "Gate on the left" };
describe("delivery details at acceptance", () => {
  it.each(["city", "address", "contact", "phone"])("requires %s before acceptance", (field) => {
    expect(deliveryDetailsSchema.safeParse({ ...details, [field]: "" }).success).toBe(false);
  });
  it("keeps unloading notes and site access", () => {
    expect(deliveryDetailsSchema.parse({ ...details, unloading: "crane_needed" })).toMatchObject({ unloading: "crane_needed", access: "Gate on the left" });
  });
  it("blocks signing new agreements without delivery details", () => {
    expect(needsDeliveryDetails(true, null)).toBe(true);
    expect(needsDeliveryDetails(true, details)).toBe(false);
  });
  it("preserves existing agreements", () => {
    expect(needsDeliveryDetails(false, null)).toBe(false);
  });
});