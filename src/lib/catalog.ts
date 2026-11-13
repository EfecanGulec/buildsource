// Supplier catalogue import (spec 18): parsing, field mapping and keyword category guess.
// Pure functions so the browser preview, the server import and the tests share one copy.

export const FIELDS = [
  "external_id", "name", "description", "category", "unit", "list_price", "currency",
  "stock_qty", "lead_time_days", "image", "datasheet_url",
] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, string>>;
export type Row = Record<string, string>;
export const LOW_CONFIDENCE = 0.75;
export const MAX_PRODUCTS = 5000;

export type RawProduct = {
  external_id: string; name: string; description: string | null; category_hint: string;
  unit: string | null; list_price: number | null; currency: string; stock_qty: number | null;
  lead_time_days: number | null; images: string[]; datasheet_url: string | null; specs: Record<string, string>;
};

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = [";", ",", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const head = splitCsvLine(lines[0], sep);
  return lines.slice(1).map((l) => {
    const cells = splitCsvLine(l, sep);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

// Reads <product>/<item>/<offer> records with flat child tags (the common XML feed shape). No DOM needed (server-safe).
export function parseXml(text: string): Row[] {
  const tag = ["product", "item", "offer", "entry"].find((t) => new RegExp(`<${t}[\\s>]`, "i").test(text));
  if (!tag) return [];
  const rows: Row[] = [];
  const rec = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  for (const m of text.matchAll(rec)) {
    const row: Row = {};
    for (const a of (m[1] ?? "").matchAll(/([\w:-]+)="([^"]*)"/g)) row[a[1]] = decode(a[2]);
    for (const c of m[2].matchAll(/<([\w:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) if (!(c[1] in row)) row[c[1]] = decode(c[2]);
    rows.push(row);
  }
  return rows;
}

export const parseFeed = (text: string, type: string): Row[] =>
  type === "xml" || text.trimStart().startsWith("<") ? parseXml(text) : parseCsv(text);

export const columnsOf = (rows: Row[]) => [...new Set(rows.slice(0, 50).flatMap((r) => Object.keys(r)))];

const SYNONYMS: Record<Field, string[]> = {
  external_id: ["id", "sku", "code", "product_id", "external_id", "kodas", "article"],
  name: ["name", "title", "product_name", "pavadinimas"],
  description: ["description", "desc", "aprasymas", "body"],
  category: ["category", "categories", "kategorija", "type", "group", "product_type"],
  unit: ["unit", "uom", "vienetas", "measure"],
  list_price: ["price", "list_price", "kaina", "regular_price", "unit_price"],
  currency: ["currency", "valiuta"],
  stock_qty: ["stock", "stock_qty", "qty", "quantity", "inventory", "likutis", "stock_quantity"],
  lead_time_days: ["lead_time", "lead_time_days", "delivery_days", "leadtime"],
  image: ["image", "image_url", "img", "picture", "photo"],
  datasheet_url: ["datasheet", "datasheet_url", "pdf", "spec_sheet"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

export function suggestMapping(columns: string[]): Mapping {
  const m: Mapping = {}; const used = new Set<string>();
  for (const f of FIELDS) {
    const hit = columns.find((c) => !used.has(c) && SYNONYMS[f].includes(norm(c)))
      ?? columns.find((c) => !used.has(c) && SYNONYMS[f].some((s) => norm(c).includes(s)));
    if (hit) { m[f] = hit; used.add(hit); }
  }
  return m;
}

const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function applyMapping(rows: Row[], m: Mapping): { products: RawProduct[]; errors: string[] } {
  const products: RawProduct[] = []; const errors: string[] = []; const seen = new Set<string>();
  const mapped = new Set(Object.values(m));
  rows.slice(0, MAX_PRODUCTS).forEach((r, i) => {
    const get = (f: Field) => (m[f] ? r[m[f]!] ?? "" : "").trim();
    const id = get("external_id") || get("name");
    const name = get("name");
    if (!id || !name) { errors.push(`Row ${i + 1}: missing id or name`); return; }
    if (seen.has(id)) { errors.push(`Row ${i + 1}: duplicate id ${id}`); return; }
    seen.add(id);
    const price = num(get("list_price"));
    if (get("list_price") && price == null) errors.push(`Row ${i + 1}: unreadable price`);
    const specs = Object.fromEntries(Object.entries(r).filter(([k, v]) => !mapped.has(k) && v && v.length < 200));
    products.push({
      external_id: id.slice(0, 120), name: name.slice(0, 300), description: get("description") || null,
      category_hint: get("category"), unit: get("unit") || null, list_price: price,
      currency: (get("currency") || "EUR").toUpperCase().slice(0, 3), stock_qty: num(get("stock_qty")),
      lead_time_days: num(get("lead_time_days")) != null ? Math.round(num(get("lead_time_days"))!) : null,
      images: get("image") ? get("image").split(/[|,\s]+/).filter((u) => /^https?:\/\//.test(u)) : [],
      datasheet_url: /^https?:\/\//.test(get("datasheet_url")) ? get("datasheet_url") : null, specs,
    });
  });
  if (rows.length > MAX_PRODUCTS) errors.push(`Only the first ${MAX_PRODUCTS} rows were imported`);
  return { products, errors };
}

export type Cat = { id: string; slug: string; name_en: string };
const KEYWORDS: Record<string, string[]> = {
  insulation: ["insulation", "mineral wool", "eps", "xps", "pir", "izoliac", "vata", "polystyrene"],
  "windows-doors": ["window", "door", "langas", "durys", "glazing", "pvc profile"],
  steel: ["steel", "rebar", "armat", "beam", "plieno", "hea", "ipe", "profile pipe"],
  roofing: ["roof", "stogo", "shingle", "membrane", "tile", "čerp"],
  "facade-systems": ["facade", "fasad", "cladding", "render", "panel system"],
  furniture: ["chair", "table", "sofa", "stool", "kėdė", "stalas", "desk", "cabinet", "shelf", "bench"],
  "commercial-equipment": ["espresso", "fridge", "refrigerat", "oven", "dishwasher", "display counter", "grinder", "freezer"],
  "fitout-kits": ["kit", "fit-out", "fitout", "package"],
};

// Exact category name/slug in the feed → 0.95; keyword in category field → 0.85; keyword only in name → 0.6.
export function guessCategory(p: Pick<RawProduct, "name" | "description" | "category_hint">, cats: Cat[]): { category_id: string | null; confidence: number } {
  const hint = p.category_hint.toLowerCase();
  const exact = cats.find((c) => hint && (hint === c.slug || hint === c.name_en.toLowerCase()));
  if (exact) return { category_id: exact.id, confidence: 0.95 };
  const scan = (text: string) => cats.filter((c) => (KEYWORDS[c.slug] ?? [c.name_en.toLowerCase()]).some((k) => text.includes(k)));
  const inHint = hint ? scan(hint) : [];
  if (inHint.length === 1) return { category_id: inHint[0].id, confidence: 0.85 };
  const inName = scan(`${p.name} ${p.description ?? ""}`.toLowerCase());
  if (inName.length === 1) return { category_id: inName[0].id, confidence: 0.6 };
  return { category_id: (inHint[0] ?? inName[0])?.id ?? null, confidence: inHint.length + inName.length ? 0.4 : 0 };
}

export const needsCheck = (p: { mapping_confidence: number | null; mapping_confirmed: boolean; category_id: string | null }) =>
  !p.mapping_confirmed && (p.category_id == null || (p.mapping_confidence ?? 0) < LOW_CONFIDENCE);

export const LEVELS = ["Dashboard only", "Spreadsheet", "Feed", "Shop connector", "ERP connector"] as const;

export const TEMPLATE_CSV = "sku;name;category;unit;price;currency;stock;lead_time_days;image;datasheet\nEX-001;Mineral wool slab 100 mm;insulation;m2;6.20;EUR;1200;5;https://example.com/img.jpg;\n";
