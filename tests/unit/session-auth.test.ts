import { describe, it, expect } from "vitest";
import {
  signSessionToken,
  verifySessionToken,
  HARDCODED_ACCOUNTS,
  SessionUser,
} from "@/lib/server/session";

describe("Hardcoded Session Authentication", () => {
  const mockUser: SessionUser = {
    userId: "test-user-1",
    profileId: "profile-1",
    username: "admin",
    role: "admin",
    fullName: "System Admin",
    isActive: true,
    mustChangePassword: false,
  };

  it("signs and verifies a valid session token", () => {
    const token = signSessionToken(mockUser);
    expect(token).toBeDefined();
    expect(token.includes(".")).toBe(true);

    const decoded = verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe("admin");
    expect(decoded?.role).toBe("admin");
    expect(decoded?.fullName).toBe("System Admin");
  });

  it("rejects tampered session tokens", () => {
    const token = signSessionToken(mockUser);
    const tampered = token.slice(0, -4) + "abcd";

    const result = verifySessionToken(tampered);
    expect(result).toBeNull();
  });

  it("contains pre-configured accounts for admin, scanner, and student", () => {
    const adminAcc = HARDCODED_ACCOUNTS.find((a) => a.credentials.username === "admin");
    const scannerAcc = HARDCODED_ACCOUNTS.find((a) => a.credentials.username === "scanner");
    const studentAcc = HARDCODED_ACCOUNTS.find((a) => a.credentials.username === "student");

    expect(adminAcc).toBeDefined();
    expect(adminAcc?.credentials.password).toBe("admin123");
    expect(adminAcc?.user.role).toBe("admin");

    expect(scannerAcc).toBeDefined();
    expect(scannerAcc?.credentials.password).toBe("scanner123");
    expect(scannerAcc?.user.role).toBe("scanner");

    expect(studentAcc).toBeDefined();
    expect(studentAcc?.credentials.password).toBe("student123");
    expect(studentAcc?.user.role).toBe("student");
  });
});
