import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { requireHome } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: ({ context }) => requireHome(context.queryClient, "/app"),
  component: () => (
    <AppShell area="app">
      <Outlet />
    </AppShell>
  ),
});
