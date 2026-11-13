import { describe, expect, it } from "vitest";
import { lensCanSubmit, normaliseLens, parseLensResult, parseLensProducts, lensProducts, DEMO_LENS, pickDemoLens } from "./lens";

const slugs = ["insulation", "furniture", "commercial-equipment"];
describe("material lens", () => {
  it("retains two different products from two photos for one RFQ", () => {
    const products = parseLensProducts(JSON.stringify({ products: [
      { ...DEMO_LENS.chair, photo_indices: [0] }, { ...DEMO_LENS.oven, photo_indices: [1] },
    ] }), slugs, 2);
    expect(products?.map((p) => p.category_slug)).toEqual(["furniture", "commercial-equipment"]);
    expect(lensProducts({ ...DEMO_LENS.chair, products: products ?? [] })).toHaveLength(2);
  });
  it("keeps multiple views of the same product as one item", () => {
    const products = parseLensProducts(JSON.stringify({ products: [{ ...DEMO_LENS.chair, photo_indices: [0, 1] }] }), slugs, 2);
    expect(products).toHaveLength(1);
    expect(products?.[0]?.photo_indices).toEqual([0, 1]);
  });
  it("rejects an analysis that skips any selected photo", () => {
    expect(parseLensProducts(JSON.stringify({ products: [{ ...DEMO_LENS.chair, photo_indices: [0] }] }), slugs, 2)).toBeNull();
  });
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
  it("accepts array markings and null specs from the model", () => {
    const r = parseLensResult(JSON.stringify({ ...DEMO_LENS.eps, visible_markings: ["EPS 100", "100 mm"], likely_specs: { a: null, b: 1 } }), slugs)!;
    expect(r.visible_markings).toBe("EPS 100 · 100 mm");
    expect(r.likely_specs).toEqual({ b: 1 });
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
