const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "http://localhost:8000";

const ACCESS_KEY = "grasp_access";
const REFRESH_KEY = "grasp_refresh";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccess(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data.access_token as string;
}

export interface ApiOptions {
  method?: string;
  body?: any;
  isForm?: boolean;
  auth?: boolean;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, isForm = false, auth = true } = opts;
  const buildHeaders = (token: string | null) => {
    const h: Record<string, string> = {};
    if (!isForm) h["Content-Type"] = "application/json";
    if (auth && token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  let token = auth ? getAccessToken() : null;
  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(token),
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const newToken = await refreshAccess();
    if (newToken) {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(newToken),
        body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(detail);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return (await res.blob()) as any;
}

export { API_BASE };