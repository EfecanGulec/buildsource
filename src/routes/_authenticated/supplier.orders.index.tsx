import { createFileRoute } from "@tanstack/react-router";
import { OrderList } from "@/components/order/order-list";

export const Route = createFileRoute("/_authenticated/supplier/orders/")({
  head: () => ({ meta: [{ title: "Orders — BuildSource LT" }] }),
  component: () => <OrderList side="supplier" />,
});
