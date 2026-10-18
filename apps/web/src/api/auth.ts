import type { LoginInput, UserDTO } from "@oc/shared";
import { api, ApiError } from "./client.ts";

export const login = (input: LoginInput) => api<{ user: UserDTO }>("/auth/login", { method: "POST", json: input });

export const logout = () => api<void>("/auth/logout", { method: "POST" });

/** Current user, or null when the session is missing or expired. */
export async function getMe(): Promise<UserDTO | null> {
  try {
    return (await api<{ user: UserDTO }>("/auth/me")).user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
