import type { ReactNode } from "react";
import { useMe } from "./useAuth.ts";

/** Hides admin controls. Usability only: the API returns 403 to agents regardless. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { data: user } = useMe();
  return user?.role === "admin" ? children : null;
}
