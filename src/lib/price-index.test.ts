import { describe, expect, it } from "vitest";
import { buildSeries } from "./price-index";
describe("price index", () => {
  it("hides months with fewer than 5 samples", () => {
    const s = buildSeries([
      { category_id: "eps", region: "Kaunas", month: "2026-06-01", avg_unit_price: 9.5, sample_count: 5 },
      { category_id: "eps", region: "Kaunas", month: "2026-05-01", avg_unit_price: 9.2, sample_count: 5 },
      { category_id: "tiles", region: "Vilnius", month: "2026-05-01", avg_unit_price: 30, sample_count: 4 },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.points.map((p) => p.month)).toEqual(["2026-05", "2026-06"]);
  });
});
