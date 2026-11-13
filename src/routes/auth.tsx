import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountType } from "@/hooks/use-account";

type Search = { mode?: "signin" | "signup" | undefined; type?: AccountType | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s["mode"] === "signup" ? "signup" : s["mode"] === "signin" ? "signin" : undefined,
    type: s["type"] === "supplier" ? "supplier" : s["type"] === "buyer" ? "buyer" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — BuildSource LT" },
      { name: "description", content: "Sign in or create a buyer or supplier account on BuildSource LT." },
      { property: "og:title", content: "Sign in — BuildSource LT" },
      { property: "og:description", content: "Create a buyer or supplier account on BuildSource LT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [type, setType] = useState<AccountType>(search.type ?? "buyer");
  const [form, setForm] = useState({ fullName: "", company: "", companyCode: "", email: "", password: "" });
  const [segment, setSegment] = useState<"contractor" | "designer" | "business">("contractor");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: form.fullName, company_name: form.company, company_code: form.companyCode, account_type: type,
              ...(type === "buyer" ? { buyer_segment: segment } : {}),
            },
          },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!form.email) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Check your inbox for a reset link");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-ink p-12 text-ink-foreground md:flex">
        <div className="grid-lines absolute inset-0 opacity-10" aria-hidden />
        <div className="relative [&_span]:text-ink-foreground"><Logo /></div>
        <blockquote className="relative">
          <p className="font-display text-3xl leading-snug">
            “Verified suppliers, comparable quotes and tracked orders — in one workflow.”
          </p>
          <p className="mt-4 text-sm opacity-70">Built for Lithuania's construction, renovation and interior design trade.</p>
        </blockquote>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8"><Logo /></div>
          {sent ? (
            <div>
              <h1 className="text-3xl">Check your email</h1>
              <p className="mt-3 text-muted-foreground">
                We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => { setSent(false); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-4xl">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signup" ? "Already registered? " : "New to BuildSource? "}
                <button className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? "Sign in" : "Create an account"}
                </button>
              </p>

              <form onSubmit={submit} className="mt-8 grid gap-4">
                {mode === "signup" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { v: "buyer", label: "Buyer", sub: "Contractor / designer", Icon: HardHat },
                        { v: "supplier", label: "Supplier", sub: "Materials & products", Icon: Building2 },
                      ] as const).map(({ v, label, sub, Icon }) => (
                        <button type="button" key={v} onClick={() => setType(v)}
                          className={cn("border p-4 text-left transition-colors",
                            type === v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}>
                          <Icon className={cn("h-5 w-5", type === v ? "text-primary" : "text-muted-foreground")} />
                          <div className="mt-3 font-semibold">{label}</div>
                          <div className="text-xs text-muted-foreground">{sub}</div>
                        </button>
                      ))}
                    </div>
                    <Field label="Full name"><Input required value={form.fullName} onChange={set("fullName")} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Company name"><Input required value={form.company} onChange={set("company")} /></Field>
                      <Field label="Company code"><Input required inputMode="numeric" pattern="[0-9]{7,9}" title="7–9 digit įmonės kodas" placeholder="e.g. 304123456" value={form.companyCode} onChange={set("companyCode")} /></Field>
                    </div>
                    {type === "buyer" && (
                      <Field label={t("segment.label")}>
                        <Select value={segment} onValueChange={(v) => setSegment(v as typeof segment)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["contractor", "designer", "business"] as const).map((s) => (
                              <SelectItem key={s} value={s}>{t(`segment.${s}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </>
                )}
                <Field label="Work email"><Input type="email" required value={form.email} onChange={set("email")} /></Field>
                <Field label="Password">
                  <Input type="password" required minLength={8} value={form.password} onChange={set("password")} />
                </Field>
                {mode === "signin" && (
                  <button type="button" onClick={forgot} className="-mt-2 justify-self-end text-xs text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </button>
                )}
                <Button type="submit" size="lg" disabled={busy}>
                  {busy ? "Please wait…" : mode === "signup" ? `Create ${type} account` : "Sign in"}
                </Button>
              </form>
              <p className="mt-6 text-xs text-muted-foreground">
                By continuing you agree to our terms. Your data is processed in line with GDPR.{" "}
                <Link to="/" className="underline">Back home</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}
