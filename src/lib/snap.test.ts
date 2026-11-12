import { describe, it, expect } from "vitest";
import { parseSnapResult, canConfirmAll, isLowConfidence, DEMO_CAFE_ITEMS } from "./snap";

const ok = JSON.stringify({ items: [{ category_slug: "insulation", description: "EPS 100", specs: {}, quantity: 520, unit: "m2", standard: "EN 13163", waste_pct: 7, confidence: 0.86, reasoning: "x" }] });

describe("snap & source", () => {
  it("rows below 0.75 confidence are low", () => {
    expect(isLowConfidence(0.74)).toBe(true);
    expect(isLowConfidence(0.75)).toBe(false);
  });
  it("Confirm all is blocked until every low row is reviewed", () => {
    expect(canConfirmAll([{ confidence: 0.6, reviewed: false }, { confidence: 0.9, reviewed: false }])).toBe(false);
    expect(canConfirmAll([{ confidence: 0.6, reviewed: true }, { confidence: 0.9, reviewed: false }])).toBe(true);
  });
  it("accepts valid JSON with allowed categories", () => {
    expect(parseSnapResult(ok, ["insulation"])?.[0].quantity).toBe(520);
  });
  it("rejects invalid JSON and unknown categories", () => {
    expect(parseSnapResult("not json", ["insulation"])).toBeNull();
    expect(parseSnapResult(ok, ["steel"])).toBeNull();
  });
  it("demo café result has 12 lines", () => {
    expect(DEMO_CAFE_ITEMS).toHaveLength(12);
  });
});
