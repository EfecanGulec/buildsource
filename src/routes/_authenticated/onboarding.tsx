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
  const c = account?.company;
  const [form, setForm] = useState({
    full_name: p?.full_name ?? "",
    company_name: c?.name ?? p?.company_name ?? "",
    company_code: c?.company_code ?? p?.company_code ?? "",
    country: c?.country ?? "LT",
    city: c?.city ?? p?.city ?? "",
    phone: p?.phone ?? "",
  });
  const [segment, setSegment] = useState<"contractor" | "designer" | "business">(c?.buyer_segment ?? "contractor");
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
      const { error: pErr } = await supabase
        .from("profiles").update({ full_name: form.full_name, phone: form.phone }).eq("id", account.user.id);
      if (pErr) throw pErr;
      const role = account.role ?? type;
      const { error } = await supabase.rpc("save_my_company", {
        _name: form.company_name, _company_code: form.company_code, _city: form.city, _country: form.country,
        ...(role === "buyer" ? { _buyer_segment: segment } : {}),
      });
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
        <p className="eyebrow">Step 1 of 2</p>
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
            <F label="Company code"><Input required inputMode="numeric" pattern="[0-9]{7,9}" title="7–9 digit įmonės kodas" value={form.company_code} onChange={set("company_code")} /></F>
            <F label="Country"><Input required value={form.country} onChange={set("country")} /></F>
            <F label="City"><Input required value={form.city} onChange={set("city")} /></F>
          </div>
          {(account?.role ?? type) === "buyer" && (
            <F label="Buyer segment">
              <div className="grid gap-2 sm:grid-cols-3">
                {([["contractor", "Contractor"], ["designer", "Interior designer"], ["business", "Business"]] as const).map(([v, l]) => (
                  <button type="button" key={v} onClick={() => setSegment(v)}
                    className={cn("rounded-md border p-3 text-left text-sm font-semibold", segment === v ? "border-primary bg-primary/5" : "border-border")}>
                    {l}
                  </button>
                ))}
              </div>
            </F>
          )}
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
