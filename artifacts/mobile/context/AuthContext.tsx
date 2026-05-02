import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type UserRole = "technician" | "supervisor" | "estimator" | "parts";

// Format: 2 letters + 4 digits  e.g. "MR1234" or "SV5678"
const CREDENTIALS: Record<string, UserRole> = {
  "MR1234": "technician",
  "JW1234": "technician",
  "SV5678": "supervisor",
  "AD0000": "supervisor",
  "ET1234": "estimator",
  "ET5678": "estimator",
  "PT1234": "parts",
  "PD1234": "parts",
};

const AUTH_KEY = "igmma_authed";
const ROLE_KEY = "igmma_role";
const CODE_KEY = "igmma_code";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole;
  userCode: string;
  attemptLogin: (letters: string, pin: string) => Promise<UserRole | false>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("technician");
  const [userCode, setUserCode] = useState("MR");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(AUTH_KEY),
      AsyncStorage.getItem(ROLE_KEY),
      AsyncStorage.getItem(CODE_KEY),
    ]).then(([auth, savedRole, savedCode]) => {
      setIsAuthenticated(auth === "true");
      setRole((savedRole as UserRole) ?? "technician");
      setUserCode(savedCode ?? "MR");
      setIsLoading(false);
    });
  }, []);

  const attemptLogin = useCallback(
    async (letters: string, pin: string): Promise<UserRole | false> => {
      const key = (letters + pin).toUpperCase();
      const matchedRole = CREDENTIALS[key];
      if (matchedRole) {
        const code = letters.toUpperCase();
        await AsyncStorage.setItem(AUTH_KEY, "true");
        await AsyncStorage.setItem(ROLE_KEY, matchedRole);
        await AsyncStorage.setItem(CODE_KEY, code);
        setRole(matchedRole);
        setUserCode(code);
        setIsAuthenticated(true);
        return matchedRole;
      }
      return false;
    },
    []
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_KEY, ROLE_KEY, CODE_KEY]);
    setIsAuthenticated(false);
    setRole("technician");
    setUserCode("MR");
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, role, userCode, attemptLogin, logout }}
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
