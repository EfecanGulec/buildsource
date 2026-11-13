import { createFileRoute } from "@tanstack/react-router";
import { AgreementView } from "@/components/agreement-view";

export const Route = createFileRoute("/_authenticated/supplier/agreements/$agreementId")({
  head: () => ({ meta: [{ title: "Supplier agreement — BuildSource LT" }, { name: "description", content: "Review the buyer’s delivery details and sign your supply agreement." }, { property: "og:title", content: "Supplier agreement — BuildSource LT" }, { property: "og:description", content: "Review the buyer’s delivery details and sign your supply agreement." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <AgreementView id={Route.useParams().agreementId} side="supplier" />,
});
