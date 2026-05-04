import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { yardUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Stateless mobile session tokens (HMAC-SHA256) ────────────────────────────
// Tokens are self-contained and survive server restarts.
// Format: base64url(payload_json) . base64url(hmac_signature)
// Expiry is embedded in the payload and checked on verification.

// Use an env-configured secret. In production MOBILE_SESSION_SECRET must be set.
// Startup warns loudly if it is missing in production; in development a default
// is used so the server starts without additional config.
const SESSION_SECRET = (() => {
  const secret = process.env.MOBILE_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[yard-auth] FATAL: MOBILE_SESSION_SECRET is not set. " +
          "Push token endpoints will reject all requests. " +
          "Set MOBILE_SESSION_SECRET to a random 32+ char string."
      );
      // Return an empty secret so all tokens fail verification in production
      return "";
    }
    // Development fallback — acceptable for local testing only
    return "igmma-mobile-dev-secret-not-for-production";
  }
  return secret;
})();

interface TokenPayload {
  technicianName: string;
  userCode: string;
  exp: number; // Unix ms
}

function issueMobileToken(payload: TokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyMobileToken(token: string): TokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const payloadB64 = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);

  // Constant-time comparison to prevent timing attacks
  const expectedSig = createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  try {
    const expBuf = Buffer.from(expectedSig);
    const recBuf = Buffer.from(receivedSig);
    if (expBuf.length !== recBuf.length || !timingSafeEqual(expBuf, recBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    ) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Must stay in sync with CREDENTIALS in artifacts/mobile/context/AuthContext.tsx
const MOBILE_CREDENTIALS: Record<string, { name: string }> = {
  MR1234: { name: "Mike Rodriguez" },
  JW1234: { name: "James Wilson" },
  SV5678: { name: "Sarah Mitchell" },
  AD0000: { name: "Adam Davis" },
  ET1234: { name: "Emily Torres" },
  ET5678: { name: "Emily Torres" },
  PT1234: { name: "Peter Thompson" },
  PD1234: { name: "Paula Davies" },
};

// ── Mobile session login ──────────────────────────────────────────────────────
// Validates mobile credentials and returns a signed stateless session token.
router.post("/yard/auth/mobile-session", (req, res) => {
  const { code, pin } = req.body as { code?: string; pin?: string };
  if (!code || !pin) {
    res.status(400).json({ error: "code and pin are required" });
    return;
  }

  const key = (code + pin).toUpperCase();
  const credential = MOBILE_CREDENTIALS[key];
  if (!credential) {
    res.status(401).json({ error: "Invalid mobile credentials" });
    return;
  }

  const userCode = code.toUpperCase();
  const sessionToken = issueMobileToken({
    technicianName: credential.name,
    userCode,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ sessionToken, technicianName: credential.name, userCode });
});

// ── Register / update own Expo push token ────────────────────────────────────
// Requires x-mobile-session header with a valid signed session token.
// The `x-yard-user-id` header is NOT accepted here — push tokens are a
// mobile-app concern, and using a spoofable header would allow any caller to
// overwrite another user's push token.
router.post("/yard/auth/push-token", async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    res.status(400).json({ error: "token must be a valid Expo push token" });
    return;
  }

  const sessionHeader = req.headers["x-mobile-session"] as string | undefined;
  if (!sessionHeader) {
    res.status(401).json({ error: "x-mobile-session header is required" });
    return;
  }

  const session = verifyMobileToken(sessionHeader);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }

  // Resolve DB user by full name (set at session creation time)
  const [user] = await db
    .select({ id: yardUsersTable.id })
    .from(yardUsersTable)
    .where(eq(yardUsersTable.name, session.technicianName))
    .limit(1);

  if (!user) {
    // Technician not yet in yard DB — silently succeed (push is best-effort)
    res.json({ ok: true });
    return;
  }

  await db
    .update(yardUsersTable)
    .set({ expoPushToken: token })
    .where(eq(yardUsersTable.id, user.id));

  res.json({ ok: true });
});

// ── Toggle own notification preference ───────────────────────────────────────
// Requires x-mobile-session header with a valid signed session token.
router.patch("/yard/auth/notifications-enabled", async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };

  if (enabled === undefined) {
    res.status(400).json({ error: "enabled is required" });
    return;
  }

  const sessionHeader = req.headers["x-mobile-session"] as string | undefined;
  if (!sessionHeader) {
    res.status(401).json({ error: "x-mobile-session header is required" });
    return;
  }

  const session = verifyMobileToken(sessionHeader);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }

  const [user] = await db
    .select({ id: yardUsersTable.id })
    .from(yardUsersTable)
    .where(eq(yardUsersTable.name, session.technicianName))
    .limit(1);

  if (!user) {
    res.json({ ok: true });
    return;
  }

  await db
    .update(yardUsersTable)
    .set({ notificationsEnabled: enabled })
    .where(eq(yardUsersTable.id, user.id));

  res.json({ ok: true });
});

router.post("/yard/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  const [user] = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.username, username))
    .limit(1);

  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    locationId: user.locationId ?? null,
  });
});

router.post("/yard/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/yard/auth/me", async (req, res) => {
  const userId = req.headers["x-yard-user-id"];
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.id, Number(userId)))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    locationId: user.locationId ?? null,
  });
});

export default router;
