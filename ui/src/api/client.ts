import type { ApiError } from "./types";

const TOKEN_KEY = "te_access_token";

// sessionStorage throws in some private modes; a missing token means "not logged in".
export const token = {
  get(): string {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? "";
    } catch {
      return "";
    }
  },
  set(value: string) {
    try {
      if (value) {
        sessionStorage.setItem(TOKEN_KEY, value);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Ignored, see above.
    }
  },
};

export type Params = Record<string, string | number>;

export interface Request {
  method?: "GET" | "POST" | "PUT";
  params?: Params;
  json?: unknown;
}

// `ok` also covers firmware errors reported as {"ok":false} in a 200 body.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; data: ApiError };

export function apiFetch(path: string, { method = "GET", params, json }: Request = {}) {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`
    : "";
  const headers: Record<string, string> = {};
  const stored = token.get();

  if (stored) {
    headers.Authorization = `Bearer ${stored}`;
  }

  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(path + query, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

export async function api<T>(path: string, request?: Request): Promise<ApiResult<T>> {
  const response = await apiFetch(path, request);
  const data = await response.json();

  return response.ok && data.ok !== false ? { ok: true, data } : { ok: false, data };
}
