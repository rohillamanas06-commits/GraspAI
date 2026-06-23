import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearTokens, getAccessToken, setTokens } from "./api";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  streak_days: number;
  last_login: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await api<User>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      clearTokens();
    }
  };

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const t = await api<{ access_token: string; refresh_token: string }>(
      "/api/auth/login",
      { method: "POST", body: { email, password }, auth: false }
    );
    setTokens(t.access_token, t.refresh_token);
    await fetchMe();
  };

  const register: AuthCtx["register"] = async (email, password, full_name) => {
    const t = await api<{ access_token: string; refresh_token: string }>(
      "/api/auth/register",
      { method: "POST", body: { email, password, full_name }, auth: false }
    );
    setTokens(t.access_token, t.refresh_token);
    await fetchMe();
  };

  const logout = async () => {
    const refresh_token = localStorage.getItem("grasp_refresh");
    try {
      if (refresh_token) await api("/api/auth/logout", { method: "POST", body: { refresh_token }, auth: false });
    } catch {}
    clearTokens();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh: fetchMe }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}