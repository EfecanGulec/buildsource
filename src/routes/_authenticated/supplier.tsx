import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/supplier")({
  component: () => (
    <AppShell area="supplier">
      <Outlet />
    </AppShell>
  ),
});
