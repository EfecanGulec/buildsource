import { z } from "zod";

export const LOW_CONFIDENCE = 0.75;

export const snapItemSchema = z.object({
  category_slug: z.string(),
  description: z.string().min(1),
  specs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  quantity: z.number().positive(),
  unit: z.string().default(""),
  standard: z.string().nullable().default(null),
  waste_pct: z.number().min(0).max(50).default(0),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().default(""),
});
export type SnapItem = z.infer<typeof snapItemSchema>;
export const snapResultSchema = z.object({ items: z.array(snapItemSchema).min(1) });

/** Parses model text as strict JSON and drops items whose category isn't allowed. Returns null if unusable. */
export function parseSnapResult(text: string, allowedSlugs: string[]): SnapItem[] | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const r = snapResultSchema.safeParse(raw);
  if (!r.success) return null;
  const allowed = new Set(allowedSlugs);
  const items = r.data.items.filter((i) => allowed.has(i.category_slug));
  return items.length ? items : null;
}

export const isLowConfidence = (c: number) => c < LOW_CONFIDENCE;

/** "Confirm all" is allowed only once every low-confidence row has been reviewed. */
export function canConfirmAll(rows: { confidence: number | null; reviewed: boolean }[]) {
  return rows.every((r) => r.confidence === null || !isLowConfidence(r.confidence) || r.reviewed);
}

/** Fixed café result used when AI is unavailable, so the live demo never breaks (spec 7.8). */
export const DEMO_CAFE_ITEMS: SnapItem[] = [
  ["furniture", "Bistro chairs, stackable", { item: "Bistro chair", material: "Beech / metal", use: "Commercial (heavy use)" }, 40, "pcs", 0, 0.93, "40 seats counted on plan"],
  ["furniture", "Bistro tables 70×70", { item: "Table", dimensions: "70x70x75", use: "Commercial (heavy use)" }, 10, "pcs", 0, 0.9, "10 tables × 4 seats"],
  ["furniture", "Bar stools", { item: "Bar stool", use: "Commercial (heavy use)" }, 6, "pcs", 0, 0.7, "Bar counter length ~4 m, stool spacing unclear"],
  ["furniture", "Bar counter with storage", { item: "Bar counter", dimensions: "400x60x110", assembly: true }, 1, "pcs", 0, 0.82, "Counter drawn along north wall"],
  ["furniture", "Upholstered wall bench", { item: "Bench", dimensions: "600x50x45", assembly: true }, 1, "pcs", 0, 0.66, "Window-side bench length estimated"],
  ["commercial-equipment", "Espresso machine, 2 groups", { item: "Espresso machine", power: "400V 3-phase", installation: true, warranty_months_min: 24 }, 1, "pcs", 0, 0.88, "Coffee station symbol on plan"],
  ["commercial-equipment", "Under-counter fridge", { item: "Fridge", dimensions: "140x70x85", installation: false, warranty_months_min: 12 }, 2, "pcs", 0, 0.84, "Two fridge symbols under bar"],
  ["commercial-equipment", "Commercial dishwasher", { item: "Glass/dish washer", power: "230V", installation: true, warranty_months_min: 12 }, 1, "pcs", 0, 0.79, "Kitchen wash zone"],
  ["commercial-equipment", "Display cooler for pastries", { item: "Display cooler", dimensions: "120x70x130", installation: false }, 1, "pcs", 0, 0.72, "Front counter display — type not labelled"],
  ["commercial-equipment", "Extraction hood", { item: "Hood", dimensions: "180x90", installation: true }, 1, "pcs", 0, 0.6, "Kitchen hood size guessed from cooking line"],
  ["insulation", "Acoustic wall insulation, kitchen partition", { material: "Stone wool", thickness_mm: 100 }, 28, "m2", 10, 0.77, "Partition 25.5 m² + 10% waste"],
  ["facade-systems", "Shopfront cladding panels", { system: "Cladding", finish: "Dark oak" }, 14, "m2", 5, 0.55, "Shopfront width from plan only; height assumed 3 m"],
].map(([category_slug, description, specs, quantity, unit, waste_pct, confidence, reasoning]) => ({
  category_slug, description, specs, quantity, unit, waste_pct, confidence, reasoning, standard: null,
})) as SnapItem[];
