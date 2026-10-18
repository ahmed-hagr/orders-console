import type { ApiErrorBody } from "@oc/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

interface ApiInit extends Omit<RequestInit, "body"> {
  json?: unknown;
}

/** The only place that calls fetch. The session cookie is httpOnly, so no token handling here. */
export async function api<T>(path: string, { json, headers, ...init }: ApiInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as (ApiErrorBody & T) | null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "http_error", body?.message ?? `Request failed (${res.status})`, body?.fields);
  }
  return body as T;
}

export const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";
