import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderParsed } from "@oc/shared";
import { ApiError } from "../../api/client.ts";
import { createOrder, deleteOrder } from "../../api/orders.ts";
import { STATS_KEY } from "../stats/useStats.ts";
import { ORDERS_KEY } from "./useOrdersQuery.ts";

const newKey = () => crypto.randomUUID();

/**
 * Owns the idempotency key for the order being entered.
 * Same key for every attempt (double-click, automatic retry, resubmit after a timeout);
 * a new key only after the server confirms the order, or when the agent explicitly starts over.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const mutation = useMutation({
    mutationFn: (input: CreateOrderParsed) => createOrder(input, idempotencyKey),
    // Retrying is safe because the key doesn't change. Don't retry 4xx: the answer won't change.
    retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status < 500),
    onSuccess: () => {
      setIdempotencyKey(newKey());
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });

  const startOver = () => {
    setIdempotencyKey(newKey());
    mutation.reset();
  };

  return { ...mutation, idempotencyKey, startOver };
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
      void qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}
