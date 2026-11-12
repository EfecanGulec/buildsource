import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — BuildSource LT" }] }),
  component: () => <SectionPlaceholder area="admin" slug="" />,
});
