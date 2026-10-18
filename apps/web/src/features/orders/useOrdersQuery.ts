import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { listOrders } from "../../api/orders.ts";
import { sleep } from "../../lib/format.ts";
import type { OrderFilters } from "./useOrderFilters.ts";

export const ORDERS_KEY = ["orders"] as const;
const PAGE_SIZE = 50;

/**
 * Correctness under rapid filter changes comes from the query key:
 * - every filter combination is its own cache entry, so a response can only ever land in the entry it was asked for;
 * - the list renders the entry for the *current* key, never "whatever answered last";
 * - when the key changes, the old request is aborted through `signal` (saves work, not needed for correctness).
 */
export function useOrdersQuery(filters: OrderFilters, simulateSlowNetwork = false) {
  return useInfiniteQuery({
    queryKey: [...ORDERS_KEY, filters],
    queryFn: async ({ pageParam, signal }) => {
      if (simulateSlowNetwork) await sleep(300 + Math.random() * 1700, signal);
      return listOrders(
        { q: filters.q || undefined, status: filters.status, sort: filters.sort, cursor: pageParam, limit: PAGE_SIZE },
        signal,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Keep showing the previous rows (dimmed) while the new filter loads, instead of flashing an empty table.
    placeholderData: keepPreviousData,
  });
}
