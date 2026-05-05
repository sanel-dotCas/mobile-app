import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { YardUser } from "@workspace/api-client-react";

const YARD_SESSION_KEY = "yard_session_token";

interface AuthContextType {
  user: YardUser | null;
  login: (user: YardUser & { sessionToken?: string }) => void;
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
      const token = localStorage.getItem(YARD_SESSION_KEY);
      if (stored) setUser(JSON.parse(stored));
      if (token) {
        setAuthTokenGetter(() => token);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (u: YardUser & { sessionToken?: string }) => {
    const { sessionToken, ...userWithoutToken } = u;
    setUser(userWithoutToken);
    localStorage.setItem("yard_user", JSON.stringify(userWithoutToken));
    if (sessionToken) {
      localStorage.setItem(YARD_SESSION_KEY, sessionToken);
      setAuthTokenGetter(() => sessionToken);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("yard_user");
    localStorage.removeItem(YARD_SESSION_KEY);
    setAuthTokenGetter(null);
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

// Derive permissions from yard user role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["view_pricing", "move_vehicles", "create_inspections", "manage_users", "view_reports", "configure_settings"],
  yard_manager: ["view_pricing", "move_vehicles", "create_inspections", "view_reports"],
  yard_operator: ["move_vehicles", "create_inspections"],
};

export function useYardPermissions() {
  const { user } = useAuth();
  const role = user?.role ?? "yard_operator";
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["yard_operator"];
  return {
    canViewPricing: permissions.includes("view_pricing"),
    canMoveVehicles: permissions.includes("move_vehicles"),
    canCreateInspections: permissions.includes("create_inspections"),
    canManageUsers: permissions.includes("manage_users"),
    canViewReports: permissions.includes("view_reports"),
    canConfigureSettings: permissions.includes("configure_settings"),
    role,
    permissions,
  };
}
