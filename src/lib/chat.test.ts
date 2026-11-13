import { describe, expect, it } from "vitest";
import { hasContactInfo } from "./chat";
describe("hasContactInfo", () => {
  it("flags emails", () => expect(hasContactInfo("write to jonas@stogas.lt")).toBe(true));
  it("flags phone numbers with spaces", () => expect(hasContactInfo("call +370 612 34567")).toBe(true));
  it("ignores quantities and dates", () => expect(hasContactInfo("480 m2 by 2026-12-01")).toBe(false));
});
