import { describe, it, expect } from "vitest";
import { isChunkLoadError, shouldReload } from "./chunk-recovery";

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
  it("does not reload again within 10 seconds", () => {
    expect(shouldReload(1000, 5000)).toBe(false);
    expect(shouldReload(1000, 12_000)).toBe(true);
    expect(shouldReload(null, 0)).toBe(true);
  });
});
