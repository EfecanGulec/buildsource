import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn("flex overflow-hidden rounded-md border border-current/20 text-xs font-semibold", className)}>
      {(["en", "lt"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={cn("px-2 py-1 uppercase", lang === l ? "bg-primary text-primary-foreground" : "opacity-70 hover:opacity-100")}>
          {l}
        </button>
      ))}
    </div>
  );
}
