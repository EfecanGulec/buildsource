import { describe, it, expect } from "vitest";
import { enforceGuardrails, sharedAiPrompt, parseAgentReply } from "./ai-agent";

const draft = { reply: "ok", message_draft: "hi", offer_draft: { lines: [{ rfq_item_id: "a", unit_price: 8.8 }, { rfq_item_id: "x", unit_price: 1 }], delivery_cost: 0, lead_time_days: null, message: null } };

describe("ai agent guardrails", () => {
  it("shared @AI replies never fill forms or drafts", () => {
    const r = enforceGuardrails(draft, "shared", ["a"]);
    expect(r.offer_draft).toBeNull(); expect(r.message_draft).toBeNull();
  });
  it("private drafts keep only this RFQ's items", () => {
    expect(enforceGuardrails(draft, "private", ["a"]).offer_draft?.lines).toEqual([{ rfq_item_id: "a", unit_price: 8.8 }]);
  });
  it("detects @AI messages", () => {
    expect(sharedAiPrompt("@AI translate to Lithuanian")).toBe("translate to Lithuanian");
    expect(sharedAiPrompt("hello @AI")).toBeNull();
  });
  it("rejects malformed model output", () => { expect(parseAgentReply("{\"reply\":1}")).toBeNull(); });
});
