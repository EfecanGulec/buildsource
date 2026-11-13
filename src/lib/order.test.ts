import { describe, expect, it } from "vitest";
import { canDispute, canPayLater, nextSupplierStatuses, stagedSplit } from "./order";
describe("order rules", () => {
  it("supplier moves forward only after payment", () => {
    expect(nextSupplierStatuses("awaiting_payment")).toEqual([]);
    expect(nextSupplierStatuses("shipped")).toEqual(["in_transit", "delivered"]);
    expect(nextSupplierStatuses("delivered")).toEqual([]);
  });
  it("staged payment is 30/70", () => expect(stagedSplit(10000)).toEqual({ first: 3000, second: 7000 }));
  it("pay later up to €20,000", () => { expect(canPayLater(20000)).toBe(true); expect(canPayLater(20000.01)).toBe(false); });
  it("disputes only after shipping, before acceptance", () => {
    expect(canDispute("processing")).toBe(false); expect(canDispute("delivered")).toBe(true); expect(canDispute("completed")).toBe(false);
  });
});
