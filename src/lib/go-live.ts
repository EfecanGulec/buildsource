// Go-live checklist (spec §19) and live acceptance tests TC15–TC22. Text keys live in translations.
import type { Service } from "./connectors/services";
export const GO_LIVE_TASKS = Array.from({ length: 14 }, (_, i) => `gl.task${i + 1}` as const);
export const LIVE_TESTS: { id: string; service: Service }[] = [
  { id: "TC15", service: "identity" }, { id: "TC16", service: "payments" }, { id: "TC17", service: "payments" },
  { id: "TC18", service: "payments" }, { id: "TC19", service: "company_data" }, { id: "TC20", service: "catalog" },
  { id: "TC21", service: "carrier" }, { id: "TC22", service: "carrier" },
];
/** A service is launch-ready when it is live, its secrets exist and its last connection test passed after any error. */
export function serviceStatus(r: { mode: string; last_success_at: string | null; last_error: string | null }, hasSecrets: boolean) {
  if (r.mode !== "live") return hasSecrets ? "ready_to_switch" : "needs_secrets";
  if (r.last_error) return "error";
  return r.last_success_at ? "live_ok" : "untested";
}
