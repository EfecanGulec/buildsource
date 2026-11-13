import { createFileRoute } from "@tanstack/react-router";
import { OrderView } from "@/components/order/order-view";

export const Route = createFileRoute("/_authenticated/supplier/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order — BuildSource LT" }] }),
  component: () => <OrderView id={Route.useParams().orderId} side="supplier" />,
});
