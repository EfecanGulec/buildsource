import { z } from "zod";

// Pure rules for the BuildSource AI chat assistant (spec 20.2), unit-tested.
export const AI_DAILY_LIMIT = 50;
export const AI_LABEL = "BuildSource AI";

export const offerDraftSchema = z.object({
  lines: z.array(z.object({ rfq_item_id: z.string(), unit_price: z.number().min(0) })),
  delivery_cost: z.number().min(0).nullable(),
  lead_time_days: z.number().int().min(0).nullable(),
  message: z.string().nullable(),
});
export const agentReplySchema = z.object({
  reply: z.string().min(1),
  message_draft: z.string().nullable(),
  offer_draft: offerDraftSchema.nullable(),
});
export type OfferDraft = z.infer<typeof offerDraftSchema>;
export type AgentReply = z.infer<typeof agentReplySchema>;

export const agentJsonSchema = {
  type: "object", additionalProperties: false, required: ["reply", "message_draft", "offer_draft"],
  properties: {
    reply: { type: "string" },
    message_draft: { type: ["string", "null"] },
    offer_draft: {
      anyOf: [{ type: "null" }, {
        type: "object", additionalProperties: false, required: ["lines", "delivery_cost", "lead_time_days", "message"],
        properties: {
          lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["rfq_item_id", "unit_price"],
            properties: { rfq_item_id: { type: "string" }, unit_price: { type: "number" } } } },
          delivery_cost: { type: ["number", "null"] },
          lead_time_days: { type: ["integer", "null"] },
          message: { type: ["string", "null"] },
        },
      }],
    },
  },
} as const;

/** Guardrails enforced in code: shared replies never carry form drafts, and drafts may only reference this RFQ's items. */
export function enforceGuardrails(r: AgentReply, scope: "private" | "shared", itemIds: string[]): AgentReply {
  if (scope === "shared") return { ...r, message_draft: null, offer_draft: null };
  if (!r.offer_draft) return r;
  const ok = new Set(itemIds);
  const lines = r.offer_draft.lines.filter((l) => ok.has(l.rfq_item_id));
  return { ...r, offer_draft: lines.length ? { ...r.offer_draft, lines } : null };
}

export function parseAgentReply(text: string): AgentReply | null {
  try { const p = agentReplySchema.safeParse(JSON.parse(text)); return p.success ? p.data : null; } catch { return null; }
}

/** "@AI translate this" → "translate this"; null when the message is not addressed to the shared AI. */
export function sharedAiPrompt(body: string): string | null {
  const m = body.trim().match(/^@ai\b[\s,:]*(.*)$/is);
  return m ? (m[1]!.trim() || "Summarise what has been agreed so far.") : null;
}
