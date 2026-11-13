import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/components/invoice/invoices";

export const Route = createFileRoute("/_authenticated/supplier/invoices")({
  head: () => ({ meta: [{ title: "Invoices — BuildSource LT" }, { name: "description", content: "All invoices for your BuildSource LT orders." }] }),
  component: () => <InvoicesPage side="supplier" />,
});
