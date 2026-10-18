import type { OrderStatus } from "./schemas/order.ts";

export type Role = "admin" | "agent";

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LineItemDTO {
  name: string;
  quantity: number;
  /** Minor units (halalas). 1 SAR = 100. */
  unitPriceMinor: number;
}

export interface OrderDTO {
  id: string;
  orderNumber: number;
  customerName: string;
  email: string;
  phone?: string;
  status: OrderStatus;
  items: LineItemDTO[];
  /** Minor units (halalas), always recalculated by the server from items. */
  totalMinor: number;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  /** Opaque keyset cursor for the next page, or null at the end. */
  nextCursor: string | null;
}

export interface OrderStats {
  byStatus: Record<OrderStatus, number>;
  revenueTodayMinor: number;
  /** Start of "today" in Asia/Riyadh, as ISO string. */
  since: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  fields?: Record<string, string>;
}
