import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

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

export const MOBILE_SESSION_KEY = "yard_mobile_session_token";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole;
  userCode: string;
  /** Authenticated session token for API calls. Non-null once a mobile-session has been obtained. */
  mobileSessionToken: string | null;
  attemptLogin: (letters: string, pin: string) => Promise<UserRole | false>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("technician");
  const [userCode, setUserCode] = useState("MR");
  const [mobileSessionToken, setMobileSessionToken] = useState<string | null>(null);

  // Restore auth state from AsyncStorage on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(AUTH_KEY),
      AsyncStorage.getItem(ROLE_KEY),
      AsyncStorage.getItem(CODE_KEY),
      AsyncStorage.getItem(MOBILE_SESSION_KEY),
    ]).then(([auth, savedRole, savedCode, savedSession]) => {
      setIsAuthenticated(auth === "true");
      setRole((savedRole as UserRole) ?? "technician");
      setUserCode(savedCode ?? "MR");
      if (savedSession) setMobileSessionToken(savedSession);
      setIsLoading(false);
    });
  }, []);

  /**
   * Calls the API to obtain (or refresh) a mobile session token, then stores it
   * in both AsyncStorage and React state so dependent effects (NotificationSetup)
   * re-run immediately when the token arrives.
   */
  const acquireMobileSession = useCallback(
    async (code: string, pin: string): Promise<void> => {
      if (Platform.OS === "web") return;
      try {
        const res = await fetch(`${BASE}/yard/auth/mobile-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, pin }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { sessionToken?: string };
        if (data.sessionToken) {
          await AsyncStorage.setItem(MOBILE_SESSION_KEY, data.sessionToken);
          setMobileSessionToken(data.sessionToken);
        }
      } catch {
        // Non-critical — push registration will silently skip without a session
      }
    },
    []
  );

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
        // Obtain a session token; updates state which triggers NotificationSetup re-run
        void acquireMobileSession(code, pin);
        return matchedRole;
      }
      return false;
    },
    [acquireMobileSession]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_KEY, ROLE_KEY, CODE_KEY, MOBILE_SESSION_KEY]);
    setIsAuthenticated(false);
    setRole("technician");
    setUserCode("MR");
    setMobileSessionToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, role, userCode, mobileSessionToken, attemptLogin, logout }}
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
