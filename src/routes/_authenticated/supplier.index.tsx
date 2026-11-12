import { createFileRoute } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/supplier/")({
  head: () => ({ meta: [{ title: "Dashboard — BuildSource LT" }] }),
  component: () => <SectionPlaceholder area="supplier" slug="" />,
});
