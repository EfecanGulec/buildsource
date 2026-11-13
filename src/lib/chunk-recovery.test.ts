import { describe, it, expect } from "vitest";
import { isChunkLoadError, nextReload } from "./chunk-recovery";

describe("chunk recovery", () => {
  it("recognises the Safari stale-module error", () => {
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });
  it("recognises the Chrome stale-module error", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /x.js"))).toBe(true);
  });
  it("ignores ordinary errors", () => {
    expect(isChunkLoadError(new Error("RFQ not found"))).toBe(false);
  });
  it("retries up to 3 times a minute with a growing delay", () => {
    const a = nextReload(null, 0)!;
    expect(a).toEqual({ state: { first: 0, count: 1 }, delay: 0 });
    const b = nextReload(a.state, 1000)!;
    expect(b.delay).toBe(800);
    const c = nextReload(b.state, 2000)!;
    expect(c.delay).toBe(1600);
    expect(nextReload(c.state, 3000)).toBeNull();
    expect(nextReload(c.state, 61_000)?.state.count).toBe(1);
  });
});
