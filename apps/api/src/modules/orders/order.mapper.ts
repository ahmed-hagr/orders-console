import type { OrderDTO, OrderStatus } from "@oc/shared";
import type { OrderDoc } from "./order.model.ts";

export const toOrderDTO = (o: OrderDoc): OrderDTO => ({
  id: String(o._id),
  orderNumber: o.orderNumber,
  customerName: o.customerName,
  email: o.email,
  ...(o.phone ? { phone: o.phone } : {}),
  status: o.status as OrderStatus,
  items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor })),
  totalMinor: o.totalMinor,
  createdAt: o.createdAt.toISOString(),
});
