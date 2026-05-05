import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import { updateMobileSessionToken } from "@/lib/authFetch";

export type UserRole = "technician" | "supervisor" | "estimator" | "parts" | "admin";

const AUTH_KEY = "igmma_authed";
const ROLE_KEY = "igmma_role";
const CODE_KEY = "igmma_code";
const NAME_KEY = "igmma_tech_name";

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
  /** Full technician name as stored in the DB (used for assignedTo lookups). */
  technicianName: string;
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
  const [technicianName, setTechnicianName] = useState("");
  const [mobileSessionToken, setMobileSessionToken] = useState<string | null>(null);

  // Restore auth state from AsyncStorage on mount.
  // If technicianName is missing (old sessions), fetch it from /yard/auth/me.
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(AUTH_KEY),
      AsyncStorage.getItem(ROLE_KEY),
      AsyncStorage.getItem(CODE_KEY),
      AsyncStorage.getItem(NAME_KEY),
      AsyncStorage.getItem(MOBILE_SESSION_KEY),
    ]).then(async ([auth, savedRole, savedCode, savedName, savedSession]) => {
      const authenticated = auth === "true";
      setIsAuthenticated(authenticated);
      setRole((savedRole as UserRole) ?? "technician");
      setUserCode(savedCode ?? "MR");

      if (savedSession) {
        setMobileSessionToken(savedSession);
        updateMobileSessionToken(savedSession);
      }

      // If we have a session but no stored name (upgraded from older version),
      // fetch it from the server so inspection filters work immediately.
      let resolvedName = savedName ?? "";
      if (authenticated && savedSession && !resolvedName) {
        try {
          const r = await fetch(`${BASE}/yard/auth/me`, {
            headers: { Authorization: `Bearer ${savedSession}` },
          });
          if (r.ok) {
            const d = await r.json();
            if (d.technicianName) {
              resolvedName = d.technicianName;
              await AsyncStorage.setItem(NAME_KEY, resolvedName);
            }
          }
        } catch { /* non-critical */ }
      }

      setTechnicianName(resolvedName);
      setIsLoading(false);
    });
  }, []);

  /**
   * Validates credentials against the server and obtains a signed mobile
   * session token. The role is returned by the server — no hardcoded
   * credential map exists in the client.
   */
  const attemptLogin = useCallback(
    async (letters: string, pin: string): Promise<UserRole | false> => {
      try {
        const res = await fetch(`${BASE}/yard/auth/mobile-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: letters, pin }),
        });
        if (!res.ok) return false;

        const data = (await res.json()) as {
          sessionToken?: string;
          technicianName?: string;
          userCode?: string;
          role?: string;
        };

        if (!data.sessionToken || !data.role) return false;

        const matchedRole = data.role as UserRole;
        const code = (data.userCode ?? letters).toUpperCase();
        const name = data.technicianName ?? "";

        await AsyncStorage.setItem(AUTH_KEY, "true");
        await AsyncStorage.setItem(ROLE_KEY, matchedRole);
        await AsyncStorage.setItem(CODE_KEY, code);
        await AsyncStorage.setItem(NAME_KEY, name);
        await AsyncStorage.setItem(MOBILE_SESSION_KEY, data.sessionToken);

        setRole(matchedRole);
        setUserCode(code);
        setTechnicianName(name);
        setIsAuthenticated(true);
        setMobileSessionToken(data.sessionToken);
        updateMobileSessionToken(data.sessionToken);

        return matchedRole;
      } catch {
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_KEY, ROLE_KEY, CODE_KEY, NAME_KEY, MOBILE_SESSION_KEY]);
    setIsAuthenticated(false);
    setRole("technician");
    setUserCode("MR");
    setTechnicianName("");
    setMobileSessionToken(null);
    updateMobileSessionToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, role, userCode, technicianName, mobileSessionToken, attemptLogin, logout }}
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
