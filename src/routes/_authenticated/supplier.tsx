import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { requireHome } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/supplier")({
  beforeLoad: ({ context }) => requireHome(context.queryClient, "/supplier"),
  component: () => (
    <AppShell area="supplier">
      <Outlet />
    </AppShell>
  ),
});
