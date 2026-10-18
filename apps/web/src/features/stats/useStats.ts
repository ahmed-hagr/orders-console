import { useQuery } from "@tanstack/react-query";
import { getStats } from "../../api/orders.ts";

export const STATS_KEY = ["orders-stats"] as const;

/** The endpoint takes 3-6 s. Leaving the page unmounts the query, which aborts the request through `signal`. */
export const useStats = () =>
  useQuery({
    queryKey: STATS_KEY,
    queryFn: ({ signal }) => getStats(signal),
    retry: false, // the user gets one explicit Retry instead
    staleTime: 60_000,
  });
