import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type UserRole = "technician" | "supervisor";

// Format: 2 letters + 4 digits  e.g. "MR1234" or "SV5678"
const CREDENTIALS: Record<string, UserRole> = {
  "MR1234": "technician",
  "JW1234": "technician",
  "SV5678": "supervisor",
  "AD0000": "supervisor",
};

const AUTH_KEY = "igmma_authed";
const ROLE_KEY = "igmma_role";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole;
  attemptLogin: (letters: string, pin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("technician");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(AUTH_KEY),
      AsyncStorage.getItem(ROLE_KEY),
    ]).then(([auth, savedRole]) => {
      setIsAuthenticated(auth === "true");
      setRole((savedRole as UserRole) ?? "technician");
      setIsLoading(false);
    });
  }, []);

  const attemptLogin = useCallback(
    async (letters: string, pin: string): Promise<boolean> => {
      const key = (letters + pin).toUpperCase();
      const matchedRole = CREDENTIALS[key];
      if (matchedRole) {
        await AsyncStorage.setItem(AUTH_KEY, "true");
        await AsyncStorage.setItem(ROLE_KEY, matchedRole);
        setRole(matchedRole);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    },
    []
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_KEY, ROLE_KEY]);
    setIsAuthenticated(false);
    setRole("technician");
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, role, attemptLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
