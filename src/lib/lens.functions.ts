import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normaliseLens, parseLensResult, pickDemoLens, LENS_MAX_PHOTOS, type LensResult } from "./lens";

const input = z.object({
  paths: z.array(z.string().min(1)).min(1).max(LENS_MAX_PHOTOS),
  note: z.string().max(500).default(""),
  hint: z.string().max(300).default(""),
  lang: z.enum(["en", "lt"]).default("en"),
});
export type LensResponse = { scanId: string; result: LensResult; source: "ai" | "demo" };

// Material Lens (spec 20.1): photos in material-scans/<company_id>/ → strict JSON → saved to material_scans.
export const identifyMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }): Promise<LensResponse> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", userId).single();
    if (!prof?.company_id) throw new Error("No company");
    if (data.paths.some((p) => !p.startsWith(`${prof.company_id}/`))) throw new Error("Forbidden");
    const { data: cats } = await supabase.from("categories").select("slug,name_en,parent_id");
    const slugs = (cats ?? []).filter((c) => c.parent_id).map((c) => c.slug);
    const urls: string[] = [];
    for (const p of data.paths) {
      const { data: s, error } = await supabase.storage.from("material-scans").createSignedUrl(p, 600);
      if (error || !s) throw new Error("Photo not found");
      urls.push(s.signedUrl);
    }

    const prompt = `You identify construction materials, furniture and equipment from photos for buyers in Lithuania.
User note: ${data.note || "none"}. Answer text fields in ${data.lang === "lt" ? "Lithuanian" : "English"}.
Allowed category_slug values: ${JSON.stringify(slugs)} (use null if none fits).
Rules: status "identified" only when confidence >= 0.6, else "uncertain" with alternatives; "not_a_material" if the photo shows something else.
Read brand/model text only if visible; never guess prices; never invent quantities (quantity is always null).
Set safety_note ONLY if the item itself may contain a health-hazardous substance (e.g. asbestos in old cement roof sheets or pipe lagging); never claim certainty. Ordinary properties like flammability are not safety notes — use null.
Return JSON only with keys: status, item_name, category_slug, confidence, alternatives[{item_name,category_slug,confidence}], plain_explanation, visible_markings, likely_specs{}, specs_to_confirm[], typical_uses[], standards_to_ask_for[], questions_to_confirm[], safety_note, rfq_item_draft{category_slug,description,specs{},unit,quantity}.`;

    let result: LensResult | null = null;
    let source: "ai" | "demo" = "ai";
    try {
      const ai = await import("@lovable.dev/ai-gateway");
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        const res = await ai.generateResponse({
          model: "openai/gpt-6-astra",
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...urls.map((u) => ({ type: "input_image" as const, image_url: u, detail: "high" as const }))] }],
          text: { format: { type: "json_object" } },
        });
        let text = "";
        for (const o of (res.output ?? []) as unknown as { type?: string; content?: { type?: string; text?: string }[] }[]) {
          if (o.type === "message") for (const c of o.content ?? []) if (c.type === "output_text" && c.text) text += c.text;
        }
        result = parseLensResult(text, slugs);
        if (!result) console.warn("identify-material unparseable", text.slice(0, 1500));
      }
    } catch (e) { console.error("identify-material AI error", e); }
    if (!result) { result = normaliseLens(pickDemoLens(`${data.hint} ${data.note}`), slugs); source = "demo"; }

    const { data: scan, error } = await supabase.from("material_scans").insert({
      company_id: prof.company_id, profile_id: userId, photo_paths: data.paths, note: data.note || null,
      status: result.status, result: result as never, source,
    }).select("id").single();
    if (error || !scan) throw new Error(error?.message ?? "Could not save scan");
    return { scanId: scan.id, result, source };
  });
