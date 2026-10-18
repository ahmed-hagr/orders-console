import {
  IDEMPOTENCY_HEADER,
  type CreateOrderParsed,
  type ListOrdersQuery,
  type OrderDTO,
  type OrderStats,
  type Page,
} from "@oc/shared";
import { api } from "./client.ts";

const toParams = (q: ListOrdersQuery) =>
  new URLSearchParams(
    Object.entries(q).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]])),
  ).toString();

export const listOrders = (q: ListOrdersQuery, signal?: AbortSignal) =>
  api<Page<OrderDTO>>(`/orders?${toParams(q)}`, { signal });

export const createOrder = (input: CreateOrderParsed, idempotencyKey: string) =>
  api<{ order: OrderDTO; replayed: boolean }>("/orders", {
    method: "POST",
    json: input,
    headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
  });

export const deleteOrder = (id: string) => api<void>(`/orders/${encodeURIComponent(id)}`, { method: "DELETE" });

export const getStats = (signal?: AbortSignal) => api<OrderStats>("/orders/stats", { signal });
