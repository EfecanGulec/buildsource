import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEMO_CAFE_ITEMS, parseSnapResult, type SnapItem } from "./snap";

const input = z.object({
  paths: z.array(z.string().min(1)).min(1).max(5),
  projectType: z.string().nullable(),
  notes: z.string().max(2000).default(""),
});

export type SnapResponse = { items: SnapItem[]; source: "ai" | "demo" | "failed" };

// Snap & Source (spec 7.8): reads the buyer's uploaded plans/photos and drafts RFQ lines.
export const snapSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }): Promise<SnapResponse> => {
    const { supabase } = context;
    const { data: cats } = await supabase.from("categories").select("slug,name_en,default_unit,field_template,parent_id");
    const leaf = (cats ?? []).filter((c) => c.parent_id);
    // Signed URLs go through storage policies, so a buyer can only send their own company's files.
    const files: { url: string; pdf: boolean; name: string }[] = [];
    for (const p of data.paths) {
      const { data: s, error } = await supabase.storage.from("rfq-uploads").createSignedUrl(p, 600);
      if (error || !s) throw new Error("File not found");
      files.push({ url: s.signedUrl, pdf: p.toLowerCase().endsWith(".pdf"), name: p.split("/").pop() ?? "file" });
    }

    const catalog = leaf.map((c) => ({ slug: c.slug, name: c.name_en, unit: c.default_unit, spec_fields: c.field_template }));
    const prompt = `You are a construction quantity surveyor in Lithuania. Read the attached plans/photos and list the materials, furniture and equipment a buyer must request quotes for.
Project type: ${data.projectType ?? "unknown"}. Buyer notes: ${data.notes || "none"}.
Use ONLY these category slugs (with their spec field keys): ${JSON.stringify(catalog)}
Return JSON only, shaped exactly: {"items":[{"category_slug":"...","description":"...","specs":{"<spec key>":"value"},"quantity":0,"unit":"m2|pcs|t|set","standard":"EN ... or null","waste_pct":0,"confidence":0.0,"reasoning":"how you got the quantity"}]}
confidence is 0-1; use below 0.75 when quantities or types are guesses.`;

    let ai: typeof import("@lovable.dev/ai-gateway");
    try { ai = await import("@lovable.dev/ai-gateway"); } catch { return { items: DEMO_CAFE_ITEMS, source: "demo" }; }

    let gatewayDown = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ai.generateResponse({
          model: "openai/gpt-6-astra",
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              ...files.map((f) => f.pdf
                ? ({ type: "input_file" as const, file_url: f.url, filename: f.name })
                : ({ type: "input_image" as const, image_url: f.url, detail: "high" as const })),
            ],
          }],
          text: { format: { type: "json_object" } },
        });
        const text = (res.output ?? []).flatMap((o) => ("content" in o && Array.isArray(o.content) ? o.content : []))
          .map((c) => (c && typeof c === "object" && "text" in c ? String(c.text) : "")).join("");
        const items = parseSnapResult(text, leaf.map((c) => c.slug));
        if (items) return { items, source: "ai" };
      } catch (e) {
        console.error("snap-source AI error", e);
        gatewayDown = true;
        break;
      }
    }
    // AI unavailable → demo sample keeps the demo alive; AI answered but unreadable → ask for manual entry.
    return gatewayDown ? { items: DEMO_CAFE_ITEMS, source: "demo" } : { items: [], source: "failed" };
  });
