import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { yardUsersTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { issueMobileToken } from "../lib/mobileSession";
import { issueYardToken } from "../lib/yardSession";
import { verifyPassword } from "../lib/passwordHash";
import type { MobilePrincipal } from "../middlewares/requireAuth";

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Simple in-memory rate limiter for auth endpoints.
// Tracks failed attempts per IP; locks out after MAX_ATTEMPTS within WINDOW_MS.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// ── Public auth router (no auth middleware required) ──────────────────────────
const publicRouter: IRouter = Router();

// ── Mobile session login ──────────────────────────────────────────────────────
// Validates code+pin against the DB (credentials are hashed; no hardcoded map).
publicRouter.post("/yard/auth/mobile-session", async (req, res) => {
  const { code, pin } = req.body as { code?: string; pin?: string };
  if (!code || !pin) {
    res.status(400).json({ error: "code and pin are required" });
    return;
  }

  const ip = req.ip ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many failed attempts. Please wait before trying again." });
    return;
  }

  // Mobile users are identified by a stable `userCode` (e.g. "MR", "ET") that
  // is completely separate from the PIN.  Multiple users may share the same
  // userCode (e.g. two estimators both using code "ET" with different PINs);
  // the correct account is selected by verifying the PIN hash, not by encoding
  // the PIN into the lookup key.
  const normalizedCode = code.toUpperCase();

  const candidates = await db
    .select({
      id: yardUsersTable.id,
      name: yardUsersTable.name,
      password: yardUsersTable.password,
      mobileRole: yardUsersTable.mobileRole,
    })
    .from(yardUsersTable)
    .where(
      and(
        eq(yardUsersTable.userCode, normalizedCode),
        isNotNull(yardUsersTable.mobileRole)
      )
    );

  // Select the candidate whose stored PIN hash matches — timing-safe.
  const user = candidates.find((c) => verifyPassword(pin, c.password));

  if (!user || !user.mobileRole) {
    recordFailedAttempt(ip);
    res.status(401).json({ error: "Invalid mobile credentials" });
    return;
  }

  clearAttempts(ip);
  const sessionToken = issueMobileToken({
    userId: user.id,
    technicianName: user.name,
    userCode: normalizedCode,
    role: user.mobileRole,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ sessionToken, technicianName: user.name, userCode: normalizedCode, role: user.mobileRole });
});

// ── Yard web login ────────────────────────────────────────────────────────────
publicRouter.post("/yard/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }

  const ip = req.ip ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many failed attempts. Please wait before trying again." });
    return;
  }

  const [user] = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.username, username))
    .limit(1);

  // Reject if user not found, password doesn't match, or this is a mobile-only account.
  if (!user || !verifyPassword(password, user.password) || user.mobileRole !== null) {
    recordFailedAttempt(ip);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  clearAttempts(ip);

  const sessionToken = issueYardToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });

  res.json({
    sessionToken,
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    locationId: user.locationId ?? null,
  });
});

publicRouter.post("/yard/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

// ── Protected auth router (requires auth middleware) ──────────────────────────
const protectedRouter: IRouter = Router();

/**
 * GET /yard/auth/me
 * Returns the current principal's identity for both yard-web and mobile sessions.
 * The mobile app uses this to restore technicianName after an app restart without
 * forcing a re-login.
 */
protectedRouter.get("/yard/auth/me", async (req, res) => {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (principal.type === "mobile") {
    res.json({
      type: "mobile",
      userCode: principal.userCode,
      technicianName: principal.technicianName,
      role: principal.role,
    });
    return;
  }

  // Yard principal — fetch live user record for full details.
  const [user] = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.id, principal.userId))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    type: "yard",
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    locationId: user.locationId ?? null,
  });
});

protectedRouter.post("/yard/auth/push-token", async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    res.status(400).json({ error: "token must be a valid Expo push token" });
    return;
  }

  const principal = res.locals.principal;
  if (!principal || principal.type !== "mobile") {
    res.status(403).json({ error: "Mobile session required for push token registration" });
    return;
  }

  const mobilePrincipal = principal as MobilePrincipal;

  // Bind by immutable user ID from the signed token — avoids name-collision risk.
  await db
    .update(yardUsersTable)
    .set({ expoPushToken: token })
    .where(eq(yardUsersTable.id, mobilePrincipal.userId));

  res.json({ ok: true });
});

protectedRouter.patch("/yard/auth/notifications-enabled", async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };

  if (enabled === undefined) {
    res.status(400).json({ error: "enabled is required" });
    return;
  }

  const principal = res.locals.principal;
  if (!principal || principal.type !== "mobile") {
    res.status(403).json({ error: "Mobile session required" });
    return;
  }

  const mobilePrincipal = principal as MobilePrincipal;

  // Bind by immutable user ID from the signed token — avoids name-collision risk.
  await db
    .update(yardUsersTable)
    .set({ notificationsEnabled: enabled })
    .where(eq(yardUsersTable.id, mobilePrincipal.userId));

  res.json({ ok: true });
});

export { publicRouter as yardAuthPublicRouter, protectedRouter as yardAuthProtectedRouter };
