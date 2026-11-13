import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { identifyMaterialByToken } from "@/lib/lens.functions";
import { LENS_MAX_PHOTOS, LENS_MAX_PX, type LensResult } from "@/lib/lens";
import { prepPhoto } from "@/lib/image-prep";

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });

/** Material Lens on the magic link page: identifies a photo without an account; nothing is stored. */
export function MagicLens({ token }: { token: string }) {
  const { t, lang } = useI18n();
  const run = useServerFn(identifyMaterialByToken);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [r, setR] = useState<LensResult | null>(null);
  async function pick(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      const images = await Promise.all(files.slice(0, LENS_MAX_PHOTOS).map(async (f) => toDataUrl(await prepPhoto(f, LENS_MAX_PX))));
      setR((await run({ data: { token, images, note, lang } })).result);
    } catch (e) { console.error(e); toast.error(t("lens.failed")); }
    finally { setBusy(false); }
  }
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <p className="flex items-center gap-2 font-medium"><Camera className="h-4 w-4 text-primary" />{t("lens.button")}</p>
      <p className="text-xs text-muted-foreground">{t("lens.hint")}</p>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("lens.note")} />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-sm">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{t("lens.reading")}</> : <><Camera className="h-4 w-4 text-primary" />{t("lens.take")}</>}
        <input type="file" accept="image/*" capture="environment" multiple className="sr-only" disabled={busy} aria-label={t("lens.take")}
          onChange={(e) => pick(Array.from(e.target.files ?? []))} />
      </label>
      {r && (<div className="space-y-2 text-sm">
        {r.safety_note && <div className="flex gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /><div><p className="font-semibold">{t("lens.safety")}</p><p>{r.safety_note}</p></div></div>}
        {r.status === "not_a_material" || r.status === "failed" ? <p>{t(r.status === "failed" ? "lens.failed" : "lens.notMaterial")}</p> : (<>
          <p className="font-semibold">{r.item_name} <span className="text-xs font-normal text-muted-foreground">{Math.round(r.confidence * 100)}%</span></p>
          <p>{r.plain_explanation}</p>
          {r.status === "uncertain" && r.alternatives.length > 0 && <p className="text-muted-foreground">{t("lens.didYouMean")} {r.alternatives.map((a) => a.item_name).join(" / ")}</p>}
          {r.visible_markings && <p><span className="text-muted-foreground">{t("lens.markings")}: </span>{r.visible_markings}</p>}
          {r.specs_to_confirm.length > 0 && <p><span className="text-muted-foreground">{t("lens.confirm")}: </span>{r.specs_to_confirm.join(", ")}</p>}
          {r.standards_to_ask_for.length > 0 && <p><span className="text-muted-foreground">{t("lens.standards")}: </span>{r.standards_to_ask_for.join(", ")}</p>}
        </>)}
        <Button size="sm" variant="ghost" onClick={() => setR(null)}>{t("lens.again")}</Button>
        <p className="text-xs text-muted-foreground">{t("ai.label")}</p>
      </div>)}
    </section>
  );
}
