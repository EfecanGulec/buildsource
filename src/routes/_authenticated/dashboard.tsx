import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText, GitCompare, Inbox, Package, Send, Truck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { accountQuery } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    const account = await context.queryClient.ensureQueryData(accountQuery);
    if (!account?.role || !account.profile?.company_name || !account.profile?.city) {
      throw redirect({ to: "/onboarding" });
    }
  },
  head: () => ({ meta: [{ title: "Dashboard — BuildSource LT" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: account } = useSuspenseQuery(accountQuery);
  const isBuyer = account?.role === "buyer";
  const cards = isBuyer
    ? [
        { icon: FileText, title: "Create RFQ", text: "Request quotes for a project" },
        { icon: GitCompare, title: "Compare quotes", text: "Price, lead time, origin" },
        { icon: Truck, title: "Track orders", text: "Payment & delivery status" },
      ]
    : [
        { icon: Inbox, title: "Incoming RFQs", text: "Requests matched to you" },
        { icon: Send, title: "My quotations", text: "Submitted offers" },
        { icon: Package, title: "Orders", text: "Confirmed by buyers" },
      ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{account?.profile?.company_name}</p>
            <h1 className="mt-2 text-4xl">Hello, {account?.profile?.full_name?.split(" ")[0] ?? "there"}</h1>
          </div>
          <Badge variant="outline" className="capitalize">{account?.role} account</Badge>
        </div>
        <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="bg-card p-8">
              <c.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-6 text-2xl">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              <p className="mt-6 text-xs text-muted-foreground">Coming in the next step</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
