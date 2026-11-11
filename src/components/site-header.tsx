import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center bg-primary text-xs font-bold text-primary-foreground">
        BS
      </span>
      <span className="font-display text-lg font-medium tracking-tight">
        BuildSource <span className="text-primary">LT</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { data: account } = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {account ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "signin" }}>Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>Create account</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
