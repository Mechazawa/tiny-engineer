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

export interface Request {
  method?: "GET" | "POST" | "PUT";
  // Query parameters; only POST /anim takes them.
  params?: Record<string, string>;
  json?: unknown;
  signal?: AbortSignal;
}

// Every firmware reply carries `ok`; errors are {"ok":false,"error":...}.
export type Reply = { ok: true };
export type ApiResult<T extends Reply> = { ok: true; data: T } | { ok: false; data: ApiError };

export function apiFetch(path: string, { method = "GET", params, json, signal }: Request = {}) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
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
    signal,
  });
}

export async function api<T extends Reply = Reply>(
  path: string,
  request?: Request,
): Promise<ApiResult<T>> {
  const data: T | ApiError = await (await apiFetch(path, request)).json();

  return data.ok ? { ok: true, data } : { ok: false, data };
}
