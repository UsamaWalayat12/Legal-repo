"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { setAuthToken, getAuthToken, registerUnauthorizedHandler } from "./api";

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = React.useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("lexintel_user");
    }
  }, []);

  // Register the logout handler so fetchAPI can call it on 401
  // without needing a page reload
  useEffect(() => {
    registerUnauthorizedHandler(logout);
  }, [logout]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = getAuthToken();
    const storedUser =
      typeof window !== "undefined" ? localStorage.getItem("lexintel_user") : null;
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // corrupted storage — clear it
        setAuthToken(null);
        if (typeof window !== "undefined") localStorage.removeItem("lexintel_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setAuthToken(newToken);
    if (typeof window !== "undefined") {
      localStorage.setItem("lexintel_user", JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
