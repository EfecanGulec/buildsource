import { Link } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import scanPhoto from "@/assets/insulation-scan.jpg";

export function LandingScan() {
  const { t } = useI18n();
  return (
    <div className="landing-scan-stage" aria-label={t("landing.f1.t")}>
      <div className="landing-phone">
        <div className="landing-camera">
          <img src={scanPhoto} alt={t("landing.scanProduct")} width={768} height={1024} />
          <div className="landing-scan-frame"><i /><i /><i /><i /></div>
          <div className="landing-scan-beam" />
          <span className="landing-scan-spec">{t("landing.scanSpec")}</span>
        </div>
        <div className="landing-phone-result">
          <span className="landing-phone-handle" />
          <div className="flex items-start justify-between gap-2 text-sm font-bold"><span>{t("landing.scanProduct")}</span><span className="text-primary tnum">92%</span></div>
          <div className="mt-3 space-y-2 text-xs font-semibold">
            <div className="flex justify-between gap-2"><span>Baltic Insulation</span><span className="tnum">€8.90/m²</span></div>
            <div className="flex justify-between gap-2"><span>Nordic Materials</span><span className="tnum">€8.40/m²</span></div>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">{t("landing.example")}</p>
          <Button asChild className="mt-auto w-full"><Link to="/auth" search={{ mode: "signup", type: "buyer" }}>{t("lens.requestOffers")}</Link></Button>
        </div>
      </div>
      <div className="landing-float landing-float-trust"><ShieldCheck className="size-5 shrink-0 text-success" /><div><p className="font-semibold">{t("landing.verified")}</p><p className="text-xs opacity-70">{t("landing.trustExample")}</p></div></div>
      <div className="landing-float landing-float-pool"><Users className="size-5 shrink-0 text-sand" /><div><p className="font-semibold">{t("landing.poolExample")}</p><p className="text-xs opacity-70">{t("landing.poolPeople")}</p></div></div>
    </div>
  );
}