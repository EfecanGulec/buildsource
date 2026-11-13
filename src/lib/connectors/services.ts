// Catalogue of external services (spec §15). Secret NAMES only — values live in server env.
export type Service =
  | "identity" | "payments" | "financing" | "company_data" | "places" | "email"
  | "whatsapp" | "sms" | "carrier" | "catalog" | "ai" | "translation";
export type Mode = "demo" | "live";

export const SERVICES: Record<Service, { label: string; secrets: string[]; demo: string }> = {
  identity: { label: "Smart-ID / Mobile-ID", secrets: ["DOKOBIT_API_KEY"], demo: "4-digit code dialog" },
  payments: { label: "Escrow payments", secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], demo: "Mock escrow ledger" },
  financing: { label: "Pay later / financing", secrets: ["PAYSERA_API_KEY"], demo: "Auto-approve up to €20,000" },
  company_data: { label: "Company register, Sodra, VMI, VIES", secrets: ["REGISTRUCENTRAS_API_KEY"], demo: "Seeded public company data" },
  places: { label: "Google reviews", secrets: ["GOOGLE_PLACES_API_KEY"], demo: "Seeded ratings" },
  email: { label: "Email", secrets: ["LOVABLE_API_KEY"], demo: "In-app notifications + copyable links" },
  whatsapp: { label: "WhatsApp", secrets: ["META_WHATSAPP_TOKEN"], demo: "Not sent" },
  sms: { label: "SMS", secrets: ["TWILIO_AUTH_TOKEN"], demo: "Not sent" },
  carrier: { label: "Carrier tracking", secrets: ["DPD_API_KEY"], demo: "Manual status updates" },
  catalog: { label: "Supplier catalogue feeds", secrets: [], demo: "Sample feed" },
  ai: { label: "AI (Snap & Source)", secrets: ["LOVABLE_API_KEY"], demo: "Café demo draft" },
  translation: { label: "Translation", secrets: ["LOVABLE_API_KEY"], demo: "Built-in EN/LT texts" },
};

/** Secrets a service still needs before it can go live. */
export const missingSecrets = (s: Service, has: (name: string) => boolean) => SERVICES[s].secrets.filter((n) => !has(n));
/** Live is allowed only when every secret is present. */
export const canGoLive = (s: Service, has: (name: string) => boolean) => missingSecrets(s, has).length === 0;
/** Retry delays for failed jobs, mirrored from SQL job_backoff (minutes). */
export const backoffMinutes = (attempt: number) => (attempt <= 1 ? 1 : attempt === 2 ? 5 : attempt === 3 ? 30 : 120);
