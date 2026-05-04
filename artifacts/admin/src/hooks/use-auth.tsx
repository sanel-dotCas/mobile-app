import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface AuthContextType {
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  login: (id: string, name: string, role: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(localStorage.getItem("admin_user_id"));
  const [userName, setUserName] = useState<string | null>(localStorage.getItem("admin_user_name"));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem("admin_user_role"));
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!userId) {
      setLocation("/");
    }
  }, [userId, setLocation]);

  const login = (id: string, name: string, role: string) => {
    localStorage.setItem("admin_user_id", id);
    localStorage.setItem("admin_user_name", name);
    localStorage.setItem("admin_user_role", role);
    setUserId(id);
    setUserName(name);
    setUserRole(role);
  };

  const logout = () => {
    localStorage.removeItem("admin_user_id");
    localStorage.removeItem("admin_user_name");
    localStorage.removeItem("admin_user_role");
    setUserId(null);
    setUserName(null);
    setUserRole(null);
    setLocation("/");
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        userName,
        userRole,
        login,
        logout,
        isAuthenticated: !!userId && userRole === "admin",
      }}
    >
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
