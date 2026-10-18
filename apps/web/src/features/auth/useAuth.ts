import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import type { LoginInput } from "@oc/shared";
import { getMe, login, logout } from "../../api/auth.ts";
import { ME_KEY } from "../../lib/queryClient.ts";

export const useMe = () => useQuery({ queryKey: ME_KEY, queryFn: getMe, staleTime: Infinity });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    // Settled, not success: even if the request fails, this browser should end up signed out.
    onSettled: async () => {
      // Mark the user as signed out first (don't clear() this query: RequireAuth is subscribed to it).
      // Navigating while the user is still set would make LoginPage bounce straight back to /orders.
      qc.setQueryData(ME_KEY, null);
      // Leaving /orders unmounts the console, which cancels in-flight requests (stats included).
      navigate("/login", { replace: true });
      // Drop everything else so the next user never sees this user's cached orders.
      await qc.cancelQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
    },
  });
}
