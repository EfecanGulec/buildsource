import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Platform settings — BuildSource LT admin" }, { name: "description", content: "Admin platform settings such as the payment decision deadline." }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform-settings"], queryFn: async () => {
    const { data, error } = await supabase.from("platform_settings").select("value").eq("key", "payment_deadline_minutes").maybeSingle();
    if (error) throw error;
    return Number(data?.value ?? 60);
  } });
  const [min, setMin] = useState("60");
  useEffect(() => { if (q.data) setMin(String(q.data)); }, [q.data]);
  async function save() {
    const { error } = await supabase.rpc("admin_set_payment_deadline", { _minutes: Number(min) });
    if (error) { toast.error(error.message); return; }
    toast.success(t("ps.saved")); qc.invalidateQueries({ queryKey: ["platform-settings"] });
  }
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("nav.platformSettings")}</h1>
      <Card>
        <CardHeader><CardTitle>{t("ps.payTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("ps.payHelp")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label htmlFor="pd">{t("ps.minutes")}</Label>
              <Input id="pd" type="number" min={5} max={10080} value={min} onChange={(e) => setMin(e.target.value)} className="w-36" /></div>
            <Button onClick={save} disabled={!min || Number(min) === q.data}>{t("common.save" as never) || "Save"}</Button>
          </div>
          {q.data != null && <p className="text-sm">{t("ps.current")}: <strong>{q.data} min</strong></p>}
        </CardContent>
      </Card>
    </div>
  );
}
