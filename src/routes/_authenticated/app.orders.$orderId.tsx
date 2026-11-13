import { createFileRoute } from "@tanstack/react-router";
import { OrderView } from "@/components/order/order-view";

export const Route = createFileRoute("/_authenticated/app/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order — BuildSource LT" }] }),
  component: () => <OrderView id={Route.useParams().orderId} side="buyer" />,
});
