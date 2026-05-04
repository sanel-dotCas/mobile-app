import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

// When MOBILE_SESSION_SECRET is not set in production, the service must
// fail-closed. Using an empty string as a fallback HMAC key would allow
// offline token forgery, so we instead use a sentinel that causes
// ALL token verifications to fail explicitly.
const MISSING_SECRET_SENTINEL = Symbol("missing-secret");

const SESSION_SECRET: string | typeof MISSING_SECRET_SENTINEL = (() => {
  const secret = process.env.MOBILE_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[authMiddleware] FATAL: MOBILE_SESSION_SECRET is not set in production. " +
          "All storage auth requests will be rejected. " +
          "Set MOBILE_SESSION_SECRET to a random 32+ char string."
      );
      return MISSING_SECRET_SENTINEL;
    }
    return "igmma-mobile-dev-secret-not-for-production";
  }
  return secret;
})();

export interface MobileTokenPayload {
  technicianName: string;
  userCode: string;
  exp: number;
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  if (SESSION_SECRET === MISSING_SECRET_SENTINEL) {
    return null;
  }

  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const payloadB64 = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);

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
    ) as MobileTokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware that requires a cryptographically-verified mobile session token
 * (x-mobile-session header, HMAC-SHA256).
 *
 * Explicitly rejects all requests when MOBILE_SESSION_SECRET is missing in
 * production (fail-closed — no empty-key fallback).
 *
 * On success, attaches the verified payload to req.mobileSession so downstream
 * handlers can read the caller's identity without re-verifying.
 *
 * Returns 401 for missing or invalid tokens.
 */
export function requireMobileAuth(req: Request, res: Response, next: NextFunction): void {
  const mobileSession = req.headers["x-mobile-session"] as string | undefined;
  if (!mobileSession) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyMobileToken(mobileSession);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }

  (req as Request & { mobileSession: MobileTokenPayload }).mobileSession = payload;
  next();
}
