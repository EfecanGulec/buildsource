import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

/** Demo Smart-ID connector (spec §2): shows a 4-digit code and confirms after 2 seconds. */
export function SmartIdDialog({
  open, onOpenChange, onConfirmed, title,
}: { open: boolean; onOpenChange: (o: boolean) => void; onConfirmed: (code: string) => void | Promise<void>; title?: string }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const c = String(Math.floor(1000 + Math.random() * 9000));
    setCode(c);
    setDone(false);
    const timer = setTimeout(async () => {
      setDone(true);
      await onConfirmed(c);
      setTimeout(() => onOpenChange(false), 600);
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-center">{title ?? t("smartid.title")}</DialogTitle>
          <DialogDescription className="text-center">{t("smartid.instructions")}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto mt-2 grid h-14 w-14 place-items-center rounded-full bg-ink text-ink-foreground">
          <Smartphone className="h-6 w-6" />
        </div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("smartid.code")}</p>
        <p className="font-display text-5xl font-extrabold tracking-[0.2em]" aria-label="Verification code">{code}</p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {done ? <><CheckCircle2 className="h-4 w-4 text-success" /> {t("smartid.confirmed")}</> : <><Loader2 className="h-4 w-4 animate-spin" /> {t("smartid.waiting")}</>}
        </p>
        <span className="mx-auto rounded-full border border-warning/50 bg-warning/15 px-2.5 py-0.5 text-xs font-semibold">{t("top.demo")}</span>
      </DialogContent>
    </Dialog>
  );
}
