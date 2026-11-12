import { createFileRoute, notFound } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/components/app-shell";
import { findNav } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/admin/$section")({
  beforeLoad: ({ params }) => {
    if (!params.section || !findNav("admin", params.section)) throw notFound();
  },
  head: () => ({ meta: [{ title: "BuildSource LT" }] }),
  component: Section,
});

function Section() {
  const { section } = Route.useParams();
  return <SectionPlaceholder area="admin" slug={section} />;
}
