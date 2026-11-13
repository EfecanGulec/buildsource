import { createFileRoute } from "@tanstack/react-router";
import { AgreementView } from "@/components/agreement-view";

export const Route = createFileRoute("/_authenticated/supplier/agreements/$agreementId")({
  head: () => ({ meta: [{ title: "Agreement — BuildSource LT" }] }),
  component: () => <AgreementView id={Route.useParams().agreementId} side="supplier" />,
});
