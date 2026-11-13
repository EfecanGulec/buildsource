// Connector interfaces with demo + live implementations, chosen by integrations.mode (spec §15.1).
import { SERVICES, missingSecrets, type Mode, type Service } from "./services";

export interface Connector { service: Service; mode: Mode; test(): Promise<{ ok: boolean; message: string }> }
export interface IdentityConnector extends Connector {
  startAuth(i: { personalCode: string }): Promise<{ sessionId: string; verificationCode: string }>;
  pollAuth(sessionId: string): Promise<{ status: "pending" | "ok" | "failed" }>;
}
export interface PaymentConnector extends Connector {
  createPayment(i: { orderId: string; amountCents: number }): Promise<{ providerPaymentId: string }>;
  release(i: { paymentId: string; amountCents: number; platformFeeCents: number }): Promise<{ providerTransferId: string }>;
  refund(i: { paymentId: string; amountCents: number }): Promise<{ providerRefundId: string }>;
}
export interface FinancingConnector extends Connector {
  checkEligibility(companyId: string, amountCents: number): Promise<{ approved: boolean; limitCents?: number; termDays: number[] }>;
}
export interface MessagingConnector extends Connector { sendEmail(to: string, template: string, data: object): Promise<string> }

const env = (n: string) => (typeof process !== "undefined" ? process.env[n] : undefined);
const has = (n: string) => !!env(n);
const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function base(service: Service, mode: Mode): Connector {
  return {
    service, mode,
    async test() {
      if (mode === "demo") return { ok: true, message: `Demo: ${SERVICES[service].demo}` };
      const miss = missingSecrets(service, has);
      if (miss.length) return { ok: false, message: `Missing secrets: ${miss.join(", ")}` };
      return { ok: true, message: "Secrets present; provider test pending live connector" };
    },
  };
}
const notLive = (s: Service) => () => { throw new Error(`${SERVICES[s].label} live connector is not built yet`); };

const demo = {
  identity: (): IdentityConnector => ({ ...base("identity", "demo"),
    async startAuth() { return { sessionId: id("demo_sid"), verificationCode: String(1000 + Math.floor(Math.random() * 9000)) }; },
    async pollAuth() { return { status: "ok" }; } }),
  payments: (): PaymentConnector => ({ ...base("payments", "demo"),
    async createPayment() { return { providerPaymentId: id("demo_pay") }; },
    async release() { return { providerTransferId: id("demo_tr") }; },
    async refund() { return { providerRefundId: id("demo_rf") }; } }),
  financing: (): FinancingConnector => ({ ...base("financing", "demo"),
    async checkEligibility(_c, amt) { return { approved: amt <= 2_000_000, limitCents: 2_000_000, termDays: [30, 60] }; } }),
  email: (): MessagingConnector => ({ ...base("email", "demo"), async sendEmail() { return id("demo_mail"); } }),
};
const live = {
  identity: (): IdentityConnector => ({ ...base("identity", "live"), startAuth: notLive("identity"), pollAuth: notLive("identity") }),
  payments: (): PaymentConnector => ({ ...base("payments", "live"), createPayment: notLive("payments"), release: notLive("payments"), refund: notLive("payments") }),
  financing: (): FinancingConnector => ({ ...base("financing", "live"), checkEligibility: notLive("financing") }),
  email: (): MessagingConnector => ({ ...base("email", "live"), sendEmail: notLive("email") }),
};

/** Factory: returns the implementation for the service's current mode. */
export function getConnector(service: Service, mode: Mode): Connector {
  const impl = (mode === "live" ? live : demo) as Record<string, () => Connector>;
  return impl[service]?.() ?? base(service, mode);
}
