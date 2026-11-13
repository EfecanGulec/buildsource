import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyMapping, guessCategory, LOW_CONFIDENCE, parseFeed, type Cat, type Mapping, type RawProduct, type Row } from "./catalog";

// Live shop connectors (spec 18.1 level 3). Keys are read from the secret the supplier named, never stored in the database.
async function fetchShop(type: string, url: string, key: string): Promise<Row[]> {
  const base = url.replace(/\/$/, "");
  if (type === "woocommerce") {
    const [ck, cs] = key.split(":");
    const r = await fetch(`${base}/wp-json/wc/v3/products?per_page=100`, { headers: { Authorization: "Basic " + btoa(`${ck}:${cs}`) } });
    if (!r.ok) throw new Error(`WooCommerce ${r.status}`);
    return ((await r.json()) as { id: number; sku?: string; name?: string; price?: string; stock_quantity?: number | null; categories?: { name: string }[]; images?: { src: string }[] }[]).map((p) => ({
      sku: String(p.sku || p.id), name: String(p.name ?? ""), price: String(p.price ?? ""), stock: String(p.stock_quantity ?? ""),
      category: p.categories?.[0]?.name ?? "", image: p.images?.[0]?.src ?? "",
    }));
  }
  if (type === "shopify") {
    const r = await fetch(`${base}/admin/api/2024-10/products.json?limit=250`, { headers: { "X-Shopify-Access-Token": key } });
    if (!r.ok) throw new Error(`Shopify ${r.status}`);
    const j = (await r.json()) as { products: { id: number; title: string; product_type: string; variants: { sku: string; price: string; inventory_quantity: number }[]; image?: { src: string } }[] };
    return j.products.map((p) => ({ sku: p.variants[0]?.sku || String(p.id), name: p.title, category: p.product_type, price: p.variants[0]?.price ?? "", stock: String(p.variants[0]?.inventory_quantity ?? ""), image: p.image?.src ?? "" }));
  }
  if (type === "prestashop") {
    const r = await fetch(`${base}/api/products?display=[id,reference,name,price,quantity]&output_format=JSON`, { headers: { Authorization: "Basic " + btoa(`${key}:`) } });
    if (!r.ok) throw new Error(`PrestaShop ${r.status}`);
    const j = (await r.json()) as { products: { id: number; reference: string; name: string | { value: string }[]; price: string; quantity?: string }[] };
    return j.products.map((p) => ({ sku: p.reference || String(p.id), name: typeof p.name === "string" ? p.name : p.name[0]?.value ?? "", price: p.price, stock: p.quantity ?? "" }));
  }
  throw new Error("ERP connectors are set up per system");
}

async function aiMap(items: RawProduct[], cats: Cat[]): Promise<Map<number, { slug: string; confidence: number }>> {
  const out = new Map<number, { slug: string; confidence: number }>();
  if (!items.length) return out;
  try {
    const ai = await import("@lovable.dev/ai-gateway");
    const res = await ai.generateResponse({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: [{ type: "input_text", text:
        `Map each construction/fit-out product to ONE category slug from ${JSON.stringify(cats.map((c) => c.slug))}, or "none".
Products: ${JSON.stringify(items.slice(0, 150).map((p, i) => ({ i, name: p.name, category: p.category_hint, description: p.description?.slice(0, 200) })))}
Return JSON only: {"map":[{"i":0,"slug":"...","confidence":0.0}]}. Use confidence below 0.75 when unsure.` }] }],
      text: { format: { type: "json_object" } },
    });
    let text = "";
    for (const o of (res.output ?? []) as unknown as { type?: string; content?: { type?: string; text?: string }[] }[])
      if (o.type === "message") for (const c of o.content ?? []) if (c.type === "output_text" && c.text) text += c.text;
    const parsed = z.object({ map: z.array(z.object({ i: z.number(), slug: z.string(), confidence: z.number().min(0).max(1) })) }).safeParse(JSON.parse(text));
    if (parsed.success) for (const m of parsed.data.map) out.set(m.i, m);
  } catch (e) { console.error("catalog AI mapping failed", e); }
  return out;
}

const input = z.object({ feedId: z.string().uuid(), content: z.string().max(5_000_000).optional() });

export const importFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: feed } = await supabase.from("product_feeds").select("*").eq("id", data.feedId).maybeSingle();
    if (!feed) throw new Error("Feed not found");
    let rows: Row[]; let mode = "file";
    if (["woocommerce", "shopify", "prestashop", "erp"].includes(feed.type)) {
      const key = feed.credentials_secret_ref ? process.env[feed.credentials_secret_ref] : undefined;
      if (key && feed.url) { rows = await fetchShop(feed.type, feed.url, key); mode = "live"; }
      else if (data.content) { rows = parseFeed(data.content, "xml"); mode = "demo"; }
      else throw new Error("Shop key not added yet");
    } else if (data.content) rows = parseFeed(data.content, feed.type);
    else if (feed.url?.startsWith("https://")) {
      const r = await fetch(feed.url, { headers: { Accept: "application/xml,text/csv,*/*" } });
      if (!r.ok) throw new Error(`Feed returned ${r.status}`);
      rows = parseFeed(await r.text(), feed.type);
    } else throw new Error("Upload a file or set a feed URL");

    const mapping = (feed.field_mapping ?? {}) as Mapping;
    const { products, errors } = applyMapping(rows, mapping);
    const { data: catRows } = await supabase.from("categories").select("id,slug,name_en").not("parent_id", "is", null);
    const cats = (catRows ?? []) as Cat[];
    const guesses = products.map((p) => guessCategory(p, cats));
    const unsure = guesses.map((g, i) => (g.confidence < LOW_CONFIDENCE ? i : -1)).filter((i) => i >= 0);
    const ai = await aiMap(unsure.map((i) => products[i]!), cats);
    unsure.forEach((pi, k) => {
      const m = ai.get(k); const c = m && cats.find((x) => x.slug === m.slug);
      if (c && m) guesses[pi] = { category_id: c.id, confidence: Math.round(m.confidence * 100) / 100 };
    });
    const payload = products.map((p, i) => ({
      external_id: p.external_id, name: p.name, description: p.description, category_id: guesses[i]!.category_id ?? "",
      unit: p.unit, list_price: p.list_price ?? "", currency: p.currency, stock_qty: p.stock_qty ?? "",
      lead_time_days: p.lead_time_days ?? "", images: p.images, datasheet_url: p.datasheet_url,
      mapping_confidence: guesses[i]!.confidence, specs: p.specs,
    }));
    const { data: res, error } = await supabase.rpc("supplier_import_products", { _feed: feed.id, _rows: payload, _errors: errors.slice(0, 100) });
    if (error) throw new Error(error.message);
    return { ...(res as { added: number; updated: number; deactivated: number }), errors: errors.length, flagged: guesses.filter((g) => g.confidence < LOW_CONFIDENCE).length, mode };
  });
