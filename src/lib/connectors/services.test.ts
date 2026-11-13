import { describe, expect, it } from "vitest";
import { backoffMinutes, canGoLive, missingSecrets } from "./services";
import { getConnector } from "./connectors";

describe("integrations", () => {
  it("live needs every secret", () => {
    expect(canGoLive("payments", (n) => n === "STRIPE_SECRET_KEY")).toBe(false);
    expect(missingSecrets("payments", (n) => n === "STRIPE_SECRET_KEY")).toEqual(["STRIPE_WEBHOOK_SECRET"]);
    expect(canGoLive("payments", () => true)).toBe(true);
  });
  it("retry backoff is 1, 5, 30, 120 min", () => {
    expect([1, 2, 3, 4, 5].map(backoffMinutes)).toEqual([1, 5, 30, 120, 120]);
  });
  it("demo connectors always pass the test", async () => {
    expect((await getConnector("identity", "demo").test()).ok).toBe(true);
  });
  it("demo financing approves up to €20,000", async () => {
    const f = getConnector("financing", "demo") as import("./connectors").FinancingConnector;
    expect((await f.checkEligibility("x", 2_000_000)).approved).toBe(true);
    expect((await f.checkEligibility("x", 2_000_001)).approved).toBe(false);
  });
});
