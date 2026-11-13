import { describe, expect, it } from "vitest";
import { preventDocumentCaching } from "./document-cache";

describe("document caching", () => {
  it("prevents reuse of HTML referencing old modules", async () => {
    const response = preventDocumentCaching(new Response("current page", {
      headers: { "content-type": "text/html; charset=utf-8", etag: "old", "last-modified": "yesterday" },
    }));
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.has("etag")).toBe(false);
    expect(response.headers.has("last-modified")).toBe(false);
    expect(await response.text()).toBe("current page");
  });
  it("leaves non-document responses unchanged", () => {
    const response = new Response("{}", { headers: { "content-type": "application/json" } });
    expect(preventDocumentCaching(response)).toBe(response);
  });
});