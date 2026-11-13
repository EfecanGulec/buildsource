import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

/** Photos from the Material Lens scan that started this RFQ; visible to the buyer and invited suppliers. */
export function ScanPhotos({ rfqId }: { rfqId: string }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["rfq-scan-photos", rfqId],
    queryFn: async () => {
      const { data } = await supabase.rpc("rfq_scan_photos", { _rfq: rfqId });
      const paths = (data as string[] | null) ?? [];
      if (!paths.length) return [];
      const { data: signed } = await supabase.storage.from("material-scans").createSignedUrls(paths, 3600);
      return (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
    },
  });
  if (!q.data?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Camera className="h-4 w-4" />{t("lens.rfqPhotos")}</p>
      <div className="flex flex-wrap gap-2">
        {q.data.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={t("lens.rfqPhotos")} className="h-24 w-24 rounded-md border object-cover" /></a>)}
      </div>
    </div>
  );
}
