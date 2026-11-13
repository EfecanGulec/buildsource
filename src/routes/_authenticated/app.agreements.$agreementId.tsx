import { createFileRoute } from "@tanstack/react-router";
import { AgreementView } from "@/components/agreement-view";

export const Route = createFileRoute("/_authenticated/app/agreements/$agreementId")({
  head: () => ({ meta: [{ title: "Buyer agreement — BuildSource LT" }, { name: "description", content: "Confirm delivery details and sign your supplier agreement." }, { property: "og:title", content: "Buyer agreement — BuildSource LT" }, { property: "og:description", content: "Confirm delivery details and sign your supplier agreement." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <AgreementView id={Route.useParams().agreementId} side="buyer" />,
});
