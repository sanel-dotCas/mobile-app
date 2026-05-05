import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  locationId: number | null;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedToken = localStorage.getItem("igmma_admin_session");
    const storedUser = localStorage.getItem("igmma_admin_user");

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.role === "admin") {
          setSessionToken(storedToken);
          setUser(userData);
        } else {
          logout();
        }
      } catch (e) {
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/yard/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        toast.error(errorText || "Login failed");
        return false;
      }

      const data = await res.json();

      if (data.role !== "admin") {
        toast.error("Access denied — admin accounts only");
        return false;
      }

      localStorage.setItem("igmma_admin_session", data.sessionToken);
      localStorage.setItem("igmma_admin_user", JSON.stringify(data));
      setSessionToken(data.sessionToken);
      setUser(data);
      toast.success("Logged in successfully");
      return true;
    } catch (error) {
      toast.error("An error occurred during login");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("igmma_admin_session");
    localStorage.removeItem("igmma_admin_user");
    setSessionToken(null);
    setUser(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export const api = async (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("igmma_admin_session");
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API request failed");
  }
  return res.json();
};
