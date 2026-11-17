import crypto from "crypto";

/**
 * Hashes a password using PBKDF2 with a random 16-byte salt and 100,000 iterations.
 * Format returned: `salt:hash` (hex encoded).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password.trim(), salt, 100_000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored `salt:hash` string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHash] = parts;

  const derivedHash = crypto
    .pbkdf2Sync(password.trim(), salt, 100_000, 64, "sha512")
    .toString("hex");

  const a = Buffer.from(derivedHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
