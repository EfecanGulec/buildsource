import { describe, expect, it } from "vitest";
import { closeOutcome, finalDiscount, tierDiscount, tierProgress, unitPrice, validTiers } from "./pool";
const tiers = [{ min_qty: 100, discount_pct: 5 }, { min_qty: 200, discount_pct: 8 }, { min_qty: 300, discount_pct: 12 }];
describe("group buy rules", () => {
  it("picks the highest reached tier", () => {
    expect(tierDiscount(tiers, 99)).toBe(0);
    expect(tierDiscount(tiers, 160)).toBe(5);
    expect(tierDiscount(tiers, 300)).toBe(12);
  });
  it("shows X more → −Y%", () => {
    expect(tierProgress(tiers, 160).next).toEqual({ more: 40, pct: 8 });
    expect(tierProgress(tiers, 350).next).toBeNull();
  });
  it("tier price is base × (1 − discount)", () => { expect(unitPrice(95, 5)).toBe(90.25); });
  it("cancels below minimum", () => {
    expect(closeOutcome(100, tiers, 90).status).toBe("cancelled");
    expect(closeOutcome(100, tiers, 210)).toEqual({ status: "confirming", discount: 8 });
  });
  it("keeps the tier at 80% confirmed, else recalculates", () => {
    expect(finalDiscount(tiers, 210, 168)).toBe(8);
    expect(finalDiscount(tiers, 210, 160)).toBe(5);
  });
  it("tiers must rise in both quantity and discount", () => {
    expect(validTiers(tiers)).toBe(true);
    expect(validTiers([{ min_qty: 100, discount_pct: 8 }, { min_qty: 200, discount_pct: 5 }])).toBe(false);
  });
});
