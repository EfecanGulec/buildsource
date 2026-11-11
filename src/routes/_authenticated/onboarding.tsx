import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { accountQuery, type AccountType } from "@/hooks/use-account";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery),
  head: () => ({ meta: [{ title: "Set up your company — BuildSource LT" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { data: account } = useSuspenseQuery(accountQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const p = account?.profile;
  const [type, setType] = useState<AccountType>(account?.role ?? "buyer");
  const [form, setForm] = useState({
    full_name: p?.full_name ?? "",
    company_name: p?.company_name ?? "",
    company_code: p?.company_code ?? "",
    country: p?.country ?? "Lithuania",
    city: p?.city ?? "",
    phone: p?.phone ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    try {
      if (!account.role) {
        const { error } = await supabase.rpc("choose_account_type", { _role: type });
        if (error) throw error;
      }
      const { error } = await supabase.from("profiles").upsert({ id: account.user.id, ...form });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["account"] });
      toast.success("Company profile saved");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="eyebrow">Step 1 of 1</p>
        <h1 className="mt-3 text-4xl">Tell us about your company</h1>
        <p className="mt-2 text-muted-foreground">This is shared with the other party when you exchange RFQs and quotes.</p>

        <form onSubmit={save} className="mt-10 grid gap-5">
          {!account?.role && (
            <div className="grid grid-cols-2 gap-3">
              {([
                { v: "buyer", label: "I'm a buyer", Icon: HardHat },
                { v: "supplier", label: "I'm a supplier", Icon: Building2 },
              ] as const).map(({ v, label, Icon }) => (
                <button type="button" key={v} onClick={() => setType(v)}
                  className={cn("flex items-center gap-3 border p-4 text-left",
                    type === v ? "border-primary bg-primary/5" : "border-border")}>
                  <Icon className="h-5 w-5 text-primary" /> <span className="font-semibold">{label}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <F label="Your full name"><Input required value={form.full_name} onChange={set("full_name")} /></F>
            <F label="Phone"><Input value={form.phone} onChange={set("phone")} placeholder="+370…" /></F>
            <F label="Company name"><Input required value={form.company_name} onChange={set("company_name")} /></F>
            <F label="Company code"><Input value={form.company_code} onChange={set("company_code")} /></F>
            <F label="Country"><Input required value={form.country} onChange={set("country")} /></F>
            <F label="City"><Input required value={form.city} onChange={set("city")} /></F>
          </div>
          <Button type="submit" size="lg" disabled={busy} className="justify-self-start">
            {busy ? "Saving…" : "Save and continue"}
          </Button>
        </form>
      </main>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
