import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "operator" | "viewer";
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: "viewer" | "operator") => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "flood_monitor_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed.user);
        setToken(parsed.token);
      }
    } catch {
      // ignore corrupted storage
    }
    setLoading(false);
  }, []);

  function persist(nextUser: AuthUser, nextToken: string) {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken }));
  }

  async function login(email: string, password: string) {
    const data = await api.login(email, password);
    persist(data.user as AuthUser, data.token);
  }

  async function register(email: string, password: string, role: "viewer" | "operator") {
    const data = await api.register(email, password, role);
    persist(data.user as AuthUser, data.token);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
