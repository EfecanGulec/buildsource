import { describe, it, expect } from "vitest";
import { applyMapping, guessCategory, needsCheck, parseCsv, parseXml, suggestMapping } from "./catalog";
import { readFileSync } from "node:fs";

const cats = [
  { id: "ins", slug: "insulation", name_en: "Insulation" },
  { id: "fur", slug: "furniture", name_en: "Furniture" },
  { id: "eq", slug: "commercial-equipment", name_en: "Commercial equipment" },
];

describe("catalogue import", () => {
  it("parses semicolon CSV with quotes", () => {
    const rows = parseCsv('sku;name;price\nA1;"Wool; 50 mm";4,10\n');
    expect(rows).toEqual([{ sku: "A1", name: "Wool; 50 mm", price: "4,10" }]);
  });
  it("parses XML product records with CDATA", () => {
    const rows = parseXml("<feed><product id=\"X\"><name><![CDATA[Chair & co]]></name><price>12</price></product></feed>");
    expect(rows).toEqual([{ id: "X", name: "Chair & co", price: "12" }]);
  });
  it("suggests mapping from common column names", () => {
    expect(suggestMapping(["SKU", "Title", "Kaina", "Stock"])).toMatchObject({ external_id: "SKU", name: "Title", list_price: "Kaina", stock_qty: "Stock" });
  });
  it("reads comma decimal prices and rejects rows without name", () => {
    const { products, errors } = applyMapping([{ sku: "1", name: "A", price: "4,10" }, { sku: "2", name: "", price: "1" }], { external_id: "sku", name: "name", list_price: "price" });
    expect(products[0].list_price).toBe(4.1);
    expect(errors).toHaveLength(1);
  });
  it("flags products below 0.75 confidence", () => {
    const g = guessCategory({ name: "Oak bar stool", description: null, category_hint: "" }, cats);
    expect(g.category_id).toBe("fur");
    expect(needsCheck({ mapping_confidence: g.confidence, mapping_confirmed: false, category_id: g.category_id })).toBe(true);
    expect(guessCategory({ name: "x", description: null, category_hint: "insulation" }, cats).confidence).toBe(0.95);
  });
  it("sample feed imports 100 products and flags some", () => {
    const rows = parseXml(readFileSync("public/samples/demo-feed.xml", "utf8"));
    const { products } = applyMapping(rows, suggestMapping(Object.keys(rows[0])));
    expect(products).toHaveLength(100);
    const flagged = products.filter((p) => guessCategory(p, cats).confidence < 0.75);
    expect(flagged.length).toBeGreaterThan(0);
  });
});
