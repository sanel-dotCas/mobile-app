import { createHmac, timingSafeEqual } from "crypto";

function resolveSecret(envKey: string, fallbackEnvKey?: string): string {
  const secret = process.env[envKey] ?? (fallbackEnvKey ? process.env[fallbackEnvKey] : undefined);
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed: refuse to start rather than sign with an empty key.
      throw new Error(
        `[yard-session] FATAL: ${envKey} is not set in production. ` +
          "Set this environment variable to a random 32+ character string before starting."
      );
    }
    return "igmma-yard-dev-secret-not-for-production";
  }
  return secret;
}

const YARD_SESSION_SECRET = resolveSecret("YARD_SESSION_SECRET", "MOBILE_SESSION_SECRET");

export interface YardTokenPayload {
  userId: number;
  username: string;
  role: string;
  exp: number;
}

export function issueYardToken(payload: YardTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", YARD_SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyYardToken(token: string): YardTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const payloadB64 = token.slice(0, dot);
  const receivedSig = token.slice(dot + 1);

  const expectedSig = createHmac("sha256", YARD_SESSION_SECRET)
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
    ) as YardTokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
