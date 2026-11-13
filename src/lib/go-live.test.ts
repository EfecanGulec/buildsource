import { describe, expect, it } from "vitest";
import { serviceStatus } from "./go-live";
const r = (mode: string, ok: string | null, err: string | null) => ({ mode, last_success_at: ok, last_error: err });
describe("serviceStatus", () => {
  it("demo without secrets needs secrets", () => expect(serviceStatus(r("demo", null, null), false)).toBe("needs_secrets"));
  it("demo with secrets is ready to switch", () => expect(serviceStatus(r("demo", null, null), true)).toBe("ready_to_switch"));
  it("live with an error is an error", () => expect(serviceStatus(r("live", "x", "boom"), true)).toBe("error"));
  it("live never tested is untested", () => expect(serviceStatus(r("live", null, null), true)).toBe("untested"));
  it("live and tested is ok", () => expect(serviceStatus(r("live", "x", null), true)).toBe("live_ok"));
});
