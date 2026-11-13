import { describe, it, expect } from "vitest";
import { planEmail, type NotificationRow } from "./notify-email";
const now = Date.parse("2026-11-13T12:00:00Z");
const n = (o: Partial<NotificationRow> = {}): NotificationRow => ({ id: "1", type: "quote", title: "Offer", body: "b", link: "/app/rfqs/9",
  profile_id: null, company_id: "c", created_at: "2026-11-13T11:00:00Z", ...o });
const real = { email: "a@firm.lt", isDemo: false };
describe("planEmail", () => {
  it("never emails demo companies", () => expect(planEmail(n(), { email: "a@firm.lt", isDemo: true }, "https://x", now)).toEqual({ skip: "demo" }));
  it("never emails @demo.lt addresses", () => expect(planEmail(n(), { email: "buyer@demo.lt", isDemo: false }, "https://x", now)).toEqual({ skip: "demo" }));
  it("skips notifications older than one day", () => expect(planEmail(n({ created_at: "2026-11-12T11:00:00Z" }), real, "https://x", now)).toEqual({ skip: "old" }));
  it("sends unclaimed suppliers the magic link", () => {
    const p = planEmail(n({ type: "new_rfq" }), { ...real, magicToken: "tok" }, "https://x/", now);
    expect(p).toMatchObject({ template: "rfq-invite", link: "https://x/q/tok" });
  });
  it("links to the in-app page otherwise", () => expect(planEmail(n(), real, "https://x", now)).toMatchObject({ template: "notification", link: "https://x/app/rfqs/9" }));
  it("keeps unknown types in-app only", () => expect(planEmail(n({ type: "commission" }), real, "https://x", now)).toEqual({ skip: "type" }));
});
