import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { YardUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: YardUser | null;
  login: (user: YardUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<YardUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("yard_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (u: YardUser) => {
    setUser(u);
    localStorage.setItem("yard_user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("yard_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
