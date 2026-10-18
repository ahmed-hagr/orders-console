import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { Spin } from "antd";
import { useMe } from "./useAuth.ts";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe();
  if (isPending) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
