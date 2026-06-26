import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { apiGet, apiPost } from "@/constants/api";

const TOKEN_KEY = "wahatna_jwt";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  score: number;
  streak_days: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function storeToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function deleteToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, isLoading: true });

  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (token) {
          const user = await apiGet<User>("/auth/me", token);
          setState({ token, user, isLoading: false });
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch {
        await deleteToken();
        setState({ token: null, user: null, isLoading: false });
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiPost<{ access_token: string }>("/auth/login", { username, password });
    const token = data.access_token;
    await storeToken(token);
    const user = await apiGet<User>("/auth/me", token);
    setState({ token, user, isLoading: false });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, role = "worker") => {
    await apiPost("/auth/register", { username, email, password, role });
    await login(username, password);
  }, [login]);

  const logout = useCallback(async () => {
    await deleteToken();
    setState({ token: null, user: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
