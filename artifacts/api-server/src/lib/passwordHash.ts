import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;
const PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Returns a salted scrypt hash in the format  `scrypt:<salt_hex>:<hash_hex>`.
 * Generates a fresh random salt on every call.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LEN, PARAMS).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/**
 * Timing-safe comparison of a plain-text password against a stored hash.
 * Returns false for any invalid / unrecognized stored format.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const derivedBuf = scryptSync(plain, salt, KEY_LEN, PARAMS);
    return hashBuf.length === derivedBuf.length && timingSafeEqual(hashBuf, derivedBuf);
  } catch {
    return false;
  }
}
