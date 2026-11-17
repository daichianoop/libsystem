import crypto from "crypto";

export const BUCKET_DURATION_SECONDS = 30;

export interface TokenVerificationResult {
  valid: boolean;
  studentId?: string;
  bucket?: number;
  isStatic?: boolean;
  errorCode?: "INVALID_FORMAT" | "EXPIRED_TOKEN" | "SIGNATURE_MISMATCH" | "INVALID_CARD";
}

/**
 * Calculates the current timestamp bucket index (every 30 seconds).
 */
export function getCurrentBucket(timestamp: number = Date.now()): number {
  return Math.floor(timestamp / 1000 / BUCKET_DURATION_SECONDS);
}

/**
 * Computes HMAC-SHA256 digest in hex.
 */
function computeHmac(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Generates rotating token: `v1.<student_id>.<bucket>.<hmac>`
 */
export function generateRotatingToken(
  studentId: string,
  cardSecret: string,
  bucket: number = getCurrentBucket()
): string {
  const payload = `${studentId}:${bucket}`;
  const hmac = computeHmac(cardSecret, payload);
  return `v1.${studentId}.${bucket}.${hmac}`;
}

/**
 * Generates static printable token for physical ID tags: `v1.static.<student_id>.<version>.<hmac>`
 */
export function generateStaticToken(
  studentId: string,
  cardSecret: string,
  credentialVersion: number = 1
): string {
  const payload = `static:${studentId}:${credentialVersion}`;
  const hmac = computeHmac(cardSecret, payload);
  return `v1.static.${studentId}.${credentialVersion}.${hmac}`;
}

/**
 * Verifies any token (rotating or static) with constant-time timingSafeEqual comparison.
 * For rotating tokens, accepts current bucket and previous bucket (±1 bucket tolerance, approx 60s total).
 */
export function verifyToken(
  token: string,
  cardSecret: string,
  currentBucket: number = getCurrentBucket(),
  expectedCredentialVersion: number = 1
): TokenVerificationResult {
  if (!token || typeof token !== "string") {
    return { valid: false, errorCode: "INVALID_FORMAT" };
  }

  const parts = token.trim().split(".");

  // 1. Static printable token: `v1.static.<student_id>.<version>.<hmac>`
  if (parts.length === 5 && parts[0] === "v1" && parts[1] === "static") {
    const studentId = parts[2];
    const version = parseInt(parts[3], 10);
    const providedHmac = parts[4];

    if (isNaN(version) || version !== expectedCredentialVersion) {
      return { valid: false, errorCode: "INVALID_CARD" };
    }

    const expectedPayload = `static:${studentId}:${version}`;
    const calculatedHmac = computeHmac(cardSecret, expectedPayload);

    const providedBuf = Buffer.from(providedHmac, "hex");
    const calculatedBuf = Buffer.from(calculatedHmac, "hex");

    if (providedBuf.length !== calculatedBuf.length || !crypto.timingSafeEqual(providedBuf, calculatedBuf)) {
      return { valid: false, errorCode: "INVALID_CARD" };
    }

    return {
      valid: true,
      studentId,
      isStatic: true,
    };
  }

  // 2. Rotating token: `v1.<student_id>.<bucket>.<hmac>`
  if (parts.length === 4 && parts[0] === "v1") {
    const studentId = parts[1];
    const bucket = parseInt(parts[2], 10);
    const providedHmac = parts[3];

    if (isNaN(bucket)) {
      return { valid: false, errorCode: "INVALID_FORMAT" };
    }

    // Accept current bucket or immediately previous bucket (±1 tolerance)
    const allowedBuckets = [currentBucket, currentBucket - 1];
    if (!allowedBuckets.includes(bucket)) {
      return { valid: false, errorCode: "EXPIRED_TOKEN" };
    }

    const payload = `${studentId}:${bucket}`;
    const calculatedHmac = computeHmac(cardSecret, payload);

    const providedBuf = Buffer.from(providedHmac, "hex");
    const calculatedBuf = Buffer.from(calculatedHmac, "hex");

    if (providedBuf.length !== calculatedBuf.length || !crypto.timingSafeEqual(providedBuf, calculatedBuf)) {
      return { valid: false, errorCode: "INVALID_CARD" };
    }

    return {
      valid: true,
      studentId,
      bucket,
      isStatic: false,
    };
  }

  return { valid: false, errorCode: "INVALID_FORMAT" };
}
