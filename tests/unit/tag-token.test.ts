import { describe, it, expect } from "vitest";
import {
  generateRotatingToken,
  generateStaticToken,
  verifyToken,
  getCurrentBucket,
} from "@/lib/tag-token";

describe("Rotating QR Tag Token Security", () => {
  const studentId = "88888888-4444-4444-4444-123456789abc";
  const cardSecret = "super-secret-random-hex-key-for-student-tag";

  it("generates a valid rotating token structure", () => {
    const bucket = getCurrentBucket();
    const token = generateRotatingToken(studentId, cardSecret, bucket);

    expect(token.startsWith("v1.")).toBe(true);
    const parts = token.split(".");
    expect(parts.length).toBe(4);
    expect(parts[1]).toBe(studentId);
    expect(parseInt(parts[2], 10)).toBe(bucket);
    expect(parts[3].length).toBe(64); // SHA-256 hex is 64 chars
  });

  it("successfully verifies valid token within current bucket", () => {
    const bucket = getCurrentBucket();
    const token = generateRotatingToken(studentId, cardSecret, bucket);
    const result = verifyToken(token, cardSecret, bucket);

    expect(result.valid).toBe(true);
    expect(result.studentId).toBe(studentId);
  });

  it("accepts token from previous bucket (tolerance within ~60s)", () => {
    const currentBucket = getCurrentBucket();
    const previousBucket = currentBucket - 1;
    const token = generateRotatingToken(studentId, cardSecret, previousBucket);

    const result = verifyToken(token, cardSecret, currentBucket);
    expect(result.valid).toBe(true);
  });

  it("rejects token expired by more than 1 bucket", () => {
    const currentBucket = getCurrentBucket();
    const oldBucket = currentBucket - 2;
    const token = generateRotatingToken(studentId, cardSecret, oldBucket);

    const result = verifyToken(token, cardSecret, currentBucket);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("EXPIRED_TOKEN");
  });

  it("rejects tampered token signature or payload", () => {
    const bucket = getCurrentBucket();
    const token = generateRotatingToken(studentId, cardSecret, bucket);
    const tampered = token.slice(0, -4) + "0000";

    const result = verifyToken(tampered, cardSecret, bucket);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_CARD");
  });

  it("verifies static printable tokens and enforces credential version", () => {
    const staticToken = generateStaticToken(studentId, cardSecret, 1);
    const validResult = verifyToken(staticToken, cardSecret, undefined, 1);
    expect(validResult.valid).toBe(true);
    expect(validResult.isStatic).toBe(true);

    // Old version fails immediately after rotation/reissue
    const rotatedResult = verifyToken(staticToken, cardSecret, undefined, 2);
    expect(rotatedResult.valid).toBe(false);
  });
});
