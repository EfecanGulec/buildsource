import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { requireHome } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => requireHome(context.queryClient, "/admin"),
  component: () => (
    <AppShell area="admin">
      <Outlet />
    </AppShell>
  ),
});
