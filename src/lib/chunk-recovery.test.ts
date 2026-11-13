import { describe, it, expect } from "vitest";
import { isChunkLoadError, nextReload, recoveryUrl } from "./chunk-recovery";

describe("chunk recovery", () => {
  it("bypasses cached HTML without losing the requested admin page", () => {
    const url = new URL(recoveryUrl("https://example.test/admin/integrations?mode=demo&__bs_refresh=1#jobs", 42));
    expect(url.pathname).toBe("/admin/integrations");
    expect(url.searchParams.get("mode")).toBe("demo");
    expect(url.searchParams.getAll("__bs_refresh")).toEqual(["42"]);
    expect(url.hash).toBe("#jobs");
  });
  it("recognises the Safari stale-module error", () => {
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });
  it("recognises the Chrome stale-module error", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /x.js"))).toBe(true);
  });
  it("ignores ordinary errors", () => {
    expect(isChunkLoadError(new Error("RFQ not found"))).toBe(false);
  });
  it("retries 3 times quickly, then 3 more times 10 s apart, per 2 minutes", () => {
    const a = nextReload(null, 0)!;
    expect(a).toEqual({ state: { first: 0, count: 1 }, delay: 0 });
    const b = nextReload(a.state, 1000)!;
    expect(b.delay).toBe(800);
    const c = nextReload(b.state, 2000)!;
    expect(c.delay).toBe(1600);
    let st = c.state;
    for (let i = 0; i < 3; i++) { const n = nextReload(st, 4000 + i)!; expect(n.delay).toBe(10_000); st = n.state; }
    expect(nextReload(st, 5000)).toBeNull();
    expect(nextReload(st, 121_000)?.state.count).toBe(1);
  });
});
