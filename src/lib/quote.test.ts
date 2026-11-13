import { describe, expect, it } from "vitest";
import { compareLabels, nextActions, offerTotals } from "./quote";

describe("offerTotals", () => {
  it("adds line totals and delivery", () => {
    expect(offerTotals([{ rfq_item_id: "a", unit_price: 12.5, quantity: 480 }, { rfq_item_id: "b", unit_price: 3, quantity: 10 }], 150))
      .toEqual({ subtotal: 6030, total: 6180 });
  });
  it("ignores negative delivery", () => {
    expect(offerTotals([{ rfq_item_id: "a", unit_price: 10, quantity: 2 }], -5).total).toBe(20);
  });
});

describe("nextActions", () => {
  it("buyer can counter a fresh quote", () => {
    expect(nextActions({ status: "sent", lastParty: "supplier", roundCount: 0, roundLimit: 3 }).buyerCounter).toBe(true);
  });
  it("blocks a 4th counter when the limit is 3", () => {
    const a = nextActions({ status: "negotiating", lastParty: "supplier", roundCount: 3, roundLimit: 3 });
    expect(a.buyerCounter).toBe(false);
    expect(a.roundLimitReached).toBe(true);
    expect(a.buyerReject).toBe(true);
  });
  it("supplier may revise only after a buyer counter", () => {
    expect(nextActions({ status: "negotiating", lastParty: "buyer", roundCount: 1, roundLimit: 3 }).supplierRevise).toBe(true);
    expect(nextActions({ status: "sent", lastParty: "supplier", roundCount: 0, roundLimit: 3 }).supplierRevise).toBe(false);
  });
  it("closed quotes allow nothing", () => {
    const a = nextActions({ status: "rejected", lastParty: "supplier", roundCount: 1, roundLimit: 3 });
    expect(a.buyerCounter || a.buyerReject || a.supplierRevise).toBe(false);
  });
});

describe("accept", () => {
  it("buyer accepts only a supplier version", () => {
    expect(nextActions({ status: "sent", lastParty: "supplier", roundCount: 3, roundLimit: 3 }).buyerAccept).toBe(true);
    expect(nextActions({ status: "negotiating", lastParty: "buyer", roundCount: 1, roundLimit: 3 }).buyerAccept).toBe(false);
  });
  it("supplier accepts only a buyer counter", () => {
    expect(nextActions({ status: "negotiating", lastParty: "buyer", roundCount: 1, roundLimit: 3 }).supplierAcceptCounter).toBe(true);
  });
});
describe("compareLabels", () => {
  it("marks lowest total and shortest lead time", () => {
    expect(compareLabels([{ id: "a", total: 5000, leadDays: 10 }, { id: "b", total: 4800, leadDays: 14 }, { id: "c", total: 5200, leadDays: null }]))
      .toEqual({ best: "b", fastest: "a" });
  });
});
