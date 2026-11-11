import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — BuildSource LT" },
      { name: "description", content: "Choose a new password for your BuildSource LT account." },
      { property: "og:title", content: "Reset password — BuildSource LT" },
      { property: "og:description", content: "Choose a new password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-4">
        <Logo />
        <h1 className="mt-4 text-3xl">Set a new password</h1>
        <Input type="password" minLength={8} required placeholder="New password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy}>Update password</Button>
      </form>
    </div>
  );
}
