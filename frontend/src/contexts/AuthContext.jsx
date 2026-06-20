import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError, setToken, getToken } from "@/api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = unauth, obj = auth
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!getToken()) {
      // No token yet — try cookie-based first
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
        return;
      } catch {
        setUser(false);
        return;
      }
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setToken(null);
      setUser(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAuthResponse = (data) => {
    if (data.access_token) setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      return handleAuthResponse(data);
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (payload) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", payload);
      return handleAuthResponse(data);
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
