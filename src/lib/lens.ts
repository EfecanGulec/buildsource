import { z } from "zod";

/** Spec 20.1: identified needs confidence ≥ 0.6, below that we show alternatives. */
export const LENS_MIN_CONFIDENCE = 0.6;
export const LENS_MAX_PHOTOS = 4;
export const LENS_MAX_PX = 1600;

const spec = z.union([z.string(), z.number(), z.boolean()]);
// Models sometimes return arrays for text, or nulls inside spec maps; coerce instead of failing the scan.
const text = z.preprocess((v) => (Array.isArray(v) ? v.join(" · ") : v), z.string().nullable());
const specMap = z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && typeof x !== "object")) : {}), z.record(z.string(), spec));
const strList = z.preprocess((v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string") : []), z.array(z.string()));
export const lensResultSchema = z.object({
  status: z.enum(["identified", "uncertain", "not_a_material", "failed"]),
  item_name: z.string().default(""),
  category_slug: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  alternatives: z.array(z.object({ item_name: z.string(), category_slug: z.string().nullable(), confidence: z.number().min(0).max(1) })).default([]),
  plain_explanation: z.string().default(""),
  visible_markings: text.default(null),
  likely_specs: specMap.default({}),
  specs_to_confirm: strList.default([]),
  typical_uses: strList.default([]),
  standards_to_ask_for: strList.default([]),
  questions_to_confirm: strList.default([]),
  safety_note: text.default(null),
  rfq_item_draft: z.object({
    category_slug: z.string().nullable(),
    description: z.string(),
    specs: specMap.default({}),
    unit: z.string().default("pcs"),
    quantity: z.unknown().transform(() => null as number | null),
  }).nullable().default(null),
});
export type LensResult = z.infer<typeof lensResultSchema>;

/** Validates model output, forces allowed categories and derives status from confidence. Null = unusable. */
export function parseLensResult(text: string, allowedSlugs: string[]): LensResult | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const r = lensResultSchema.safeParse(raw);
  if (!r.success) return null;
  return normaliseLens(r.data, allowedSlugs);
}

export function normaliseLens(res: LensResult, allowedSlugs: string[]): LensResult {
  const ok = new Set(allowedSlugs);
  const slug = (s: string | null) => (s && ok.has(s) ? s : null);
  const out: LensResult = {
    ...res,
    category_slug: slug(res.category_slug),
    alternatives: res.alternatives.map((a) => ({ ...a, category_slug: slug(a.category_slug) })),
    rfq_item_draft: res.rfq_item_draft ? { ...res.rfq_item_draft, category_slug: slug(res.rfq_item_draft.category_slug), quantity: null } : null,
  };
  if (out.status === "identified" && out.confidence < LENS_MIN_CONFIDENCE) out.status = "uncertain";
  if (out.status === "uncertain" && out.confidence >= LENS_MIN_CONFIDENCE && out.category_slug) out.status = "identified";
  if (out.status === "not_a_material" || out.status === "failed") out.rfq_item_draft = null;
  return out;
}

/** An RFQ from a scan can't be sent without a real quantity (TC25). */
export const lensCanSubmit = (quantity: number | null | undefined) => typeof quantity === "number" && quantity > 0;

const base = { alternatives: [], visible_markings: null, safety_note: null, questions_to_confirm: [] };
/** Fixed results so the demo works without AI (spec Step 24). Picked by keywords in file name / note. */
export const DEMO_LENS: Record<"eps" | "chair" | "oven", LensResult> = {
  eps: { ...base, status: "identified", item_name: "Expanded polystyrene (EPS) insulation board", category_slug: "insulation", confidence: 0.82,
    alternatives: [{ item_name: "XPS insulation board", category_slug: "insulation", confidence: 0.11 }],
    plain_explanation: "White foam board made of small fused beads, commonly used for facade and floor insulation.",
    visible_markings: "EPS 100 · 100 mm (printed on edge)", likely_specs: { material: "EPS", grade: "EPS 100", thickness_mm: 100 },
    specs_to_confirm: ["Grade (EPS 70 / 100 / 150)", "Thickness", "Fire class", "Board size"],
    typical_uses: ["Facade insulation (ETICS)", "Floor insulation"], standards_to_ask_for: ["EN 13163", "CE marking / Declaration of Performance"],
    questions_to_confirm: ["Is it for the facade or the floor?", "What total area do you need?"],
    rfq_item_draft: { category_slug: "insulation", description: "EPS 100 facade insulation boards, 100 mm", specs: { material: "EPS", grade: "EPS 100", thickness_mm: 100 }, unit: "m2", quantity: null } },
  chair: { ...base, status: "identified", item_name: "Stackable bistro chair (beech / metal)", category_slug: "furniture", confidence: 0.78,
    plain_explanation: "Light café chair with a bent-wood seat and metal frame, designed to stack for cleaning.",
    likely_specs: { item: "Bistro chair", material: "Beech / metal", use: "Commercial (heavy use)" },
    specs_to_confirm: ["Seat height", "Frame finish", "Stackable count", "Commercial load rating"],
    typical_uses: ["Cafés", "Restaurants", "Canteens"], standards_to_ask_for: ["EN 16139 (non-domestic seating)"],
    questions_to_confirm: ["How many seats?", "Indoor or terrace?"],
    rfq_item_draft: { category_slug: "furniture", description: "Stackable bistro chairs, beech seat, metal frame", specs: { item: "Bistro chair", material: "Beech / metal", use: "Commercial (heavy use)" }, unit: "pcs", quantity: null } },
  oven: { ...base, status: "identified", item_name: "Combi steam oven, 6 × GN 1/1", category_slug: "commercial-equipment", confidence: 0.74,
    plain_explanation: "Professional oven that cooks with hot air, steam or both; standard in restaurant kitchens.",
    likely_specs: { item: "Combi oven", power: "400V 3-phase", installation: true }, specs_to_confirm: ["Tray count (6/10)", "Electric or gas", "Water connection", "Warranty"],
    typical_uses: ["Restaurant kitchens", "Bakeries"], standards_to_ask_for: ["CE marking", "EN 60335-2-42"],
    rfq_item_draft: { category_slug: "commercial-equipment", description: "Combi steam oven, 6 × GN 1/1, electric", specs: { item: "Combi oven", power: "400V 3-phase", installation: true }, unit: "pcs", quantity: null } },
};
export function pickDemoLens(hint: string): LensResult {
  const h = hint.toLowerCase();
  if (/chair|kėd|bistro|seat/.test(h)) return DEMO_LENS.chair;
  if (/oven|krosn|combi|kitchen/.test(h)) return DEMO_LENS.oven;
  return DEMO_LENS.eps;
}
