import { describe, expect, it } from "vitest";
import { DEMO_LENS } from "./lens";
import { lensItemPhotos } from "./lens-item-photos";

describe("RFQ item photo association", () => {
  it("associates distinct products with their own photo and title", () => {
    const paths = ["chair.jpg", "oven.jpg"];
    expect(lensItemPhotos({ ...DEMO_LENS.chair, photo_indices: [0] }, paths)).toEqual({ itemTitle: DEMO_LENS.chair.item_name, photoPaths: ["chair.jpg"] });
    expect(lensItemPhotos({ ...DEMO_LENS.oven, photo_indices: [1] }, paths)).toEqual({ itemTitle: DEMO_LENS.oven.item_name, photoPaths: ["oven.jpg"] });
  });
  it("keeps all angles of the same product together", () => {
    expect(lensItemPhotos({ ...DEMO_LENS.chair, photo_indices: [0, 2] }, ["front.jpg", "other.jpg", "back.jpg"]).photoPaths).toEqual(["front.jpg", "back.jpg"]);
  });
  it("does not shift photo indices when other products are omitted", () => {
    expect(lensItemPhotos({ ...DEMO_LENS.oven, photo_indices: [2] }, ["other.jpg", "chair.jpg", "oven.jpg"]).photoPaths).toEqual(["oven.jpg"]);
  });
});