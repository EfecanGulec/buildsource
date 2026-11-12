import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SmartIdDialog } from "@/components/smart-id-dialog";
import { requireHome } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/verify")({
  beforeLoad: ({ context }) => requireHome(context.queryClient, "/verify"),
  head: () => ({ meta: [{ title: "Verify identity — BuildSource LT" }] }),
  component: Verify,
});

function Verify() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function confirmed() {
    const { error } = await supabase.rpc("mark_smart_id_verified");
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["account"] });
    toast.success(t("verify.done"));
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("verify.step")}</p>
        <h1 className="mt-2 text-4xl">{t("verify.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("verify.sub")}</p>
        <Button size="lg" className="mt-8" onClick={() => setOpen(true)}>{t("smartid.cta")}</Button>
      </main>
      <SmartIdDialog open={open} onOpenChange={setOpen} onConfirmed={confirmed} />
    </div>
  );
}
