import { describe, expect, it } from "vitest";
import { driverNext, isLate, mismatchSummary, podMismatch, supplierNext } from "./shipment";

const lines = [{ key: "a", name: "EPS", unit: "m2", quantity: 600 }, { key: "b", name: "Glue", unit: "pcs", quantity: 10 }];

describe("shipment rules", () => {
  it("pickup: supplier only marks ready, buyer confirms", () => {
    expect(supplierNext("pickup", "planned")).toEqual(["ready_for_pickup"]);
    expect(supplierNext("pickup", "ready_for_pickup")).toEqual([]);
  });
  it("statuses only move forward", () => {
    expect(supplierNext("supplier_own", "in_transit")).toEqual(["out_for_delivery", "delivered", "failed"]);
    expect(supplierNext("carrier", "delivered")).toEqual([]);
  });
  it("driver steps: picked up → on the way → delivered form", () => {
    expect(driverNext("planned")).toBe("picked_up");
    expect(driverNext("picked_up")).toBe("in_transit");
    expect(driverNext("in_transit")).toBe("deliver");
    expect(driverNext("delivered")).toBeNull();
  });
  it("flags a quantity mismatch", () => {
    expect(podMismatch(lines, { a: 600, b: 10 })).toBe(false);
    expect(podMismatch(lines, { a: 550, b: 10 })).toBe(true);
    expect(mismatchSummary(lines, [{ key: "a", received: 550 }, { key: "b", received: 10 }])).toBe("EPS: 550 of 600 m2");
  });
  it("late when planned date passed and not delivered", () => {
    expect(isLate("2026-11-10", "in_transit", "2026-11-13")).toBe(true);
    expect(isLate("2026-11-10", "delivered", "2026-11-13")).toBe(false);
    expect(isLate("2026-11-13", "planned", "2026-11-13")).toBe(false);
  });
});
