import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — BuildSource LT" }] }),
  component: () => <SectionPlaceholder area="app" slug="" />,
});
