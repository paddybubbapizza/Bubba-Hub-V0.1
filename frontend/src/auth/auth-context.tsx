import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import { api, setAuthToken, TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import type { User } from "@/src/types";

type AuthContextValue = {
  user: User | null;
  booting: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) {
        setAuthToken(token);
        try {
          const me = await api<User>("/auth/me");
          setUserState(me);
        } catch {
          setAuthToken(null);
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setBooting(false);
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setAuthToken(res.access_token);
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUserState(res.user);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUserState(null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await api<User>("/auth/me");
    setUserState(me);
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  return (
    <AuthContext.Provider value={{ user, booting, signIn, signOut, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
