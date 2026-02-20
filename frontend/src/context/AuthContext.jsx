import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "../lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async ({ silent = false } = {}) => {
    try {
      const resp = await api.get("/auth/profile/");
      setUser(resp.data);
      return resp.data;
    } catch {
      setUser(null);
      if (!silent) throw new Error("Unable to load profile");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      if (!getAccessToken()) {
        clearTokens();
        setUser(null);
        setLoading(false);
        return;
      }

      await fetchProfile({ silent: true });
    };

    initializeAuth();
  }, []);

  const login = async (username, password) => {
    const resp = await api.post("/auth/login/", { username, password });
    setTokens(resp.data);
    await fetchProfile();
  };

  const register = async (payload) => {
    const response = await api.post("/auth/register/", payload);
    return response.data;
  };

  const logout = async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        await api.post("/auth/logout/", { refresh });
      }
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
