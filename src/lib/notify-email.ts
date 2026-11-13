// Pure rules for turning an in-app notification into an email (unit-tested).
export interface NotificationRow {
  id: string; type: string; title: string; body: string | null; link: string | null;
  profile_id: string | null; company_id: string | null; created_at: string;
}
export interface Recipient { email: string; isDemo: boolean; magicToken?: string | null }

export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Notification types that become an email; anything else stays in-app only. */
export const EMAIL_INTRO: Record<string, string> = {
  new_rfq: "A buyer has sent you a new request for quotation.",
  matched: "Your request was sent to matching suppliers.",
  declined: "A supplier declined your request. We are sending it to the next best match.",
  message: "You have a new message.",
  quote: "You received a new offer.",
  quote_revised: "An offer on your request was updated.",
  counter_offer: "The buyer sent a counter-offer.",
  counter_rejected: "Your counter-offer was rejected.",
  rejected_by_buyer: "The buyer rejected your offer.",
  agreement: "An agreement is waiting for your signature.",
  order: "There is an update on your order.",
  dispute: "A dispute was opened on your order.",
  pool: "There is an update on your Group Buy.",
  delivery: "There is an update on your delivery.",
};

export type EmailPlan =
  | { skip: "demo" | "type" | "old" | "no_recipient" }
  | { template: "rfq-invite" | "notification"; link: string; data: Record<string, string> };

export function planEmail(n: NotificationRow, r: Recipient | null, appUrl: string, now = Date.now()): EmailPlan {
  if (now - new Date(n.created_at).getTime() > MAX_AGE_MS) return { skip: "old" };
  if (!r || !r.email) return { skip: "no_recipient" };
  if (r.isDemo || /@demo\.lt$/i.test(r.email)) return { skip: "demo" };
  const base = appUrl.replace(/\/$/, "");
  if (n.type === "new_rfq" && r.magicToken)
    return { template: "rfq-invite", link: `${base}/q/${r.magicToken}`, data: { title: n.title, body: n.body ?? "" } };
  const intro = EMAIL_INTRO[n.type];
  if (!intro) return { skip: "type" };
  return { template: "notification", link: base + (n.link ?? "/"), data: { title: n.title, body: n.body ?? "", intro } };
}
