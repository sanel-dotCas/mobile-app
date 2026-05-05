import { createHmac, timingSafeEqual } from "crypto";

function resolveSecret(): string {
  const secret = process.env.MOBILE_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed: refuse to start rather than sign with an empty key.
      throw new Error(
        "[mobile-session] FATAL: MOBILE_SESSION_SECRET is not set in production. " +
          "Set this environment variable to a random 32+ character string before starting."
      );
    }
    return "igmma-mobile-dev-secret-not-for-production";
  }
  return secret;
}

const SESSION_SECRET = resolveSecret();

export interface MobileTokenPayload {
  userId: number;
  technicianName: string;
  userCode: string;
  role: string;
  exp: number;
}

export function issueMobileToken(payload: MobileTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
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
