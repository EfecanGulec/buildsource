import { createFileRoute, notFound } from "@tanstack/react-router";
import { SectionPlaceholder } from "@/components/app-shell";
import { findNav } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/app/$section")({
  beforeLoad: ({ params }) => {
    if (!params.section || !findNav("app", params.section)) throw notFound();
  },
  head: () => ({ meta: [{ title: "BuildSource LT" }] }),
  component: Section,
});

function Section() {
  const { section } = Route.useParams();
  return <SectionPlaceholder area="app" slug={section} />;
}
