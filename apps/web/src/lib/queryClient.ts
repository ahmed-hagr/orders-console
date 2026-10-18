import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client.ts";

export const ME_KEY = ["me"] as const;

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      // Session expired mid-use: drop the user so RequireAuth sends them to the login page.
      if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(ME_KEY, null);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});
