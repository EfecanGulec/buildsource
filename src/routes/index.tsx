import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Check, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/lang-toggle";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/translations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuildSource LT — Snap a photo, get verified quotes, buy together" },
      { name: "description", content: "B2B sourcing in Lithuania: turn a photo or plan into an RFQ, get quotes from verified suppliers, compare, pay into escrow and buy together." },
      { property: "og:title", content: "BuildSource LT — verified quotes for construction & fit-out" },
      { property: "og:description", content: "Snap a photo, get verified quotes, buy together. Kaunas & Vilnius." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Camera, t: "landing.f1.t", d: "landing.f1.d" },
  { icon: ShieldCheck, t: "landing.f2.t", d: "landing.f2.d" },
  { icon: Users, t: "landing.f3.t", d: "landing.f3.d" },
] as const;
const steps: TKey[] = ["landing.s1", "landing.s2", "landing.s3", "landing.s4", "landing.s5"];

function Index() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <section className="bg-ink text-ink-foreground">
        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent font-display text-xs font-extrabold text-accent-foreground">BS</span>
            <span className="font-display text-lg font-bold">BuildSource LT</span>
          </Link>
          <nav className="flex items-center gap-2">
            <LangToggle />
            <Button asChild variant="ghost" size="sm" className="text-ink-foreground hover:bg-accent/10 hover:text-ink-foreground">
              <Link to="/auth" search={{ mode: "signin" }}>{t("landing.signIn")}</Link>
            </Button>
            <Button asChild size="sm" className="hidden bg-accent text-accent-foreground hover:bg-accent/90 sm:inline-flex">
              <Link to="/auth" search={{ mode: "signup" }}>{t("landing.getStarted")}</Link>
            </Button>
          </nav>
        </header>
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pb-32 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t("landing.eyebrow")}</p>
          <h1 className="mt-6 max-w-4xl text-5xl leading-[1.05] md:text-7xl">{t("landing.title")}</h1>
          <p className="mt-6 max-w-2xl text-lg opacity-80">{t("landing.sub")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth" search={{ mode: "signup", type: "buyer" }}>{t("landing.ctaBuyer")} <ArrowRight /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-accent/40 bg-transparent text-ink-foreground hover:bg-accent/10 hover:text-ink-foreground">
              <Link to="/auth" search={{ mode: "signup", type: "supplier" }}>{t("landing.ctaSupplier")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("landing.features")}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="rounded-lg border border-border bg-card p-7">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10"><f.icon className="h-5 w-5 text-primary" /></span>
              <h3 className="mt-6 text-xl">{t(f.t)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(f.d)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl md:text-4xl">{t("landing.how")}</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s} className="border-t-2 border-primary pt-4">
                <span className="font-display text-sm font-bold text-primary">0{i + 1}</span>
                <p className="mt-2 font-semibold">{t(s)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-20 md:grid-cols-2">
        {(["buyers", "suppliers"] as const).map((who) => (
          <div key={who} className={who === "buyers" ? "rounded-lg bg-primary p-8 text-primary-foreground" : "rounded-lg bg-ink p-8 text-ink-foreground"}>
            <h2 className="text-3xl">{t(`landing.${who}.t`)}</h2>
            <p className="mt-2 opacity-80">{t(`landing.${who}.d`)}</p>
            <ul className="mt-6 grid gap-3">
              {(["l1", "l2", "l3"] as const).map((l) => (
                <li key={l} className="flex gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-accent" />{t(`landing.${who}.${l}`)}</li>
              ))}
            </ul>
            <Button asChild className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth" search={{ mode: "signup", type: who === "buyers" ? "buyer" : "supplier" }}>
                {t(who === "buyers" ? "landing.ctaBuyer" : "landing.ctaSupplier")} <ArrowRight />
              </Link>
            </Button>
          </div>
        ))}
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} BuildSource LT</span>
          <span>Kaunas · Vilnius</span>
        </div>
      </footer>
    </div>
  );
}
