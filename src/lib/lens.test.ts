import { describe, expect, it } from "vitest";
import { lensCanSubmit, normaliseLens, parseLensResult, DEMO_LENS, pickDemoLens } from "./lens";

const slugs = ["insulation", "furniture", "commercial-equipment"];
describe("material lens", () => {
  it("downgrades identified below 0.6 to uncertain", () => {
    const r = normaliseLens({ ...DEMO_LENS.eps, confidence: 0.55 }, slugs);
    expect(r.status).toBe("uncertain");
  });
  it("drops categories not in the list", () => {
    const r = parseLensResult(JSON.stringify({ ...DEMO_LENS.eps, category_slug: "rockets" }), slugs)!;
    expect(r.category_slug).toBeNull();
  });
  it("never keeps an AI quantity and no draft for non-materials", () => {
    const r = normaliseLens({ ...DEMO_LENS.eps, rfq_item_draft: { ...DEMO_LENS.eps.rfq_item_draft!, quantity: 300 } }, slugs);
    expect(r.rfq_item_draft?.quantity).toBeNull();
    expect(normaliseLens({ ...DEMO_LENS.eps, status: "not_a_material" }, slugs).rfq_item_draft).toBeNull();
  });
  it("needs a positive quantity to submit", () => {
    expect(lensCanSubmit(null)).toBe(false);
    expect(lensCanSubmit(0)).toBe(false);
    expect(lensCanSubmit(12)).toBe(true);
  });
  it("picks demo by hint", () => {
    expect(pickDemoLens("bistro-chair.jpg").category_slug).toBe("furniture");
    expect(pickDemoLens("x.jpg").category_slug).toBe("insulation");
  });
});
