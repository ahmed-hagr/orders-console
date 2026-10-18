import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Unmounting the console cancels any in-flight requests (stats included).
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}
