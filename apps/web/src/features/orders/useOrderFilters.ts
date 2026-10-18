import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { OrderSort, OrderStatus } from "@oc/shared";

export interface OrderFilters {
  q: string;
  status: OrderStatus | undefined;
  sort: OrderSort;
}

/** Filters live in the URL, so a filtered view survives reload and can be shared. */
export function useOrderFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<OrderFilters>(
    () => ({
      q: params.get("q") ?? "",
      status: OrderStatus.safeParse(params.get("status")).data,
      sort: OrderSort.safeParse(params.get("sort")).data ?? "date_desc",
    }),
    [params],
  );

  const setFilters = useCallback(
    (patch: Partial<OrderFilters>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === "" || (k === "sort" && v === "date_desc")) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return { filters, setFilters };
}
