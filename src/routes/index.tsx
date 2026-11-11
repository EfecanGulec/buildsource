import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, GitCompare, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuildSource LT — Source building materials in Lithuania" },
      {
        name: "description",
        content:
          "Submit one RFQ, get matched with verified local and international suppliers, compare quotes side by side and track delivery.",
      },
      { property: "og:title", content: "BuildSource LT — B2B sourcing for the built environment" },
      {
        property: "og:description",
        content: "One RFQ. Matched suppliers. Side-by-side quotes. Tracked orders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: FileText, title: "Submit an RFQ", text: "Tag it to new construction, renovation or interior design and pick the material category." },
  { icon: GitCompare, title: "Compare quotes", text: "Matched suppliers respond with price, production lead time and warehouse origin — side by side." },
  { icon: Truck, title: "Order & track", text: "Confirm the best offer and follow payment and delivery status in one place." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-lines absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <p className="eyebrow">B2B sourcing · Lithuania</p>
          <h1 className="mt-6 max-w-3xl text-5xl leading-[1.05] md:text-7xl">
            One request. Every supplier worth asking.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            BuildSource LT connects contractors, renovation firms and interior designers with local and
            international material suppliers.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup", type: "buyer" }}>
                I'm sourcing materials <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signup", type: "supplier" }}>I'm a supplier</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">How it works</p>
        <div className="mt-8 grid gap-px border border-border bg-border md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-card p-8">
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-primary" />
                <span className="font-display text-sm text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-8 text-2xl">{s.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} BuildSource LT</span>
          <a href="mailto:hello@buildsource.lt" className="hover:text-foreground">hello@buildsource.lt</a>
        </div>
      </footer>
    </div>
  );
}
