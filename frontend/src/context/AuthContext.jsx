import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { clearTokens, setTokens } from "../lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const resp = await api.get("/auth/profile/");
      setUser(resp.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Enforce logout on every fresh visit/reload.
    clearTokens();
    setUser(null);
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const resp = await api.post("/auth/login/", { username, password });
    setTokens(resp.data);
    await fetchProfile();
  };

  const register = async (payload) => {
    await api.post("/auth/register/", payload);
    try {
      await login(payload.username, payload.password);
    } catch (error) {
      error.registeredButLoginFailed = true;
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      // Intentionally ignored: local token cleanup is authoritative.
    }
    clearTokens();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: !!user, login, register, logout, fetchProfile }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
