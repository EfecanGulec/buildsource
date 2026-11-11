import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, HardHat } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { cn } from "@/lib/utils";
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
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [type, setType] = useState<AccountType>(search.type ?? "buyer");
  const [form, setForm] = useState({ fullName: "", company: "", email: "", password: "" });
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
            data: { full_name: form.fullName, company_name: form.company, account_type: type },
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

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
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

              <div className="mt-8 grid gap-3">
                <Button type="button" variant="outline" className="h-11 gap-2.5" onClick={() => social("google")}>
                  <GoogleG /> Continue with Google
                </Button>
                <button type="button" className="lovable-auth-button" onClick={() => social("lovable")}>
                  Continue with Lovable
                </button>
              </div>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="grid gap-4">
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
                    <Field label="Company name"><Input required value={form.company} onChange={set("company")} /></Field>
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
