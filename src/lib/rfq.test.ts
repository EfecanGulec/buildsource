import { describe, expect, it } from "vitest";
import { isoWeek, kitQuantity } from "./rfq";

describe("isoWeek", () => {
  it("gives ISO week for a mid-year date", () => expect(isoWeek("2026-11-26")).toBe("2026-W48"));
  it("puts 1 Jan 2027 (Friday) in 2026-W53", () => expect(isoWeek("2027-01-01")).toBe("2026-W53"));
});
describe("kitQuantity", () => {
  it("40 seats / 4 = 10 tables", () => expect(kitQuantity("seats/4", { seats: 40 })).toBe(10));
  it("rounds waste up", () => expect(kitQuantity("facade_m2*1.05", { facade_m2: 486 })).toBe(511));
});
