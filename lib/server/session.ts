import crypto from "crypto";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SessionUser,
  decodeSessionToken,
} from "../session-token";

export { SESSION_COOKIE_NAME, decodeSessionToken };
export type { SessionUser };

const SESSION_SECRET =
  process.env.SESSION_SECRET || "hostel-library-pass-system-jwt-secret-key-2026";

// ------------------------------------------------------------------------------
// HARDCODED DEMO ACCOUNTS
// ------------------------------------------------------------------------------
export const HARDCODED_ACCOUNTS: Array<{
  credentials: { username: string; password: string };
  user: SessionUser;
}> = [
  {
    credentials: { username: "admin", password: "admin123" },
    user: {
      userId: "user-admin-001",
      profileId: "11111111-0000-0000-0000-000000000001",
      username: "admin",
      role: "admin",
      fullName: "Central Library Administrator",
      isActive: true,
      mustChangePassword: false,
    },
  },
  {
    credentials: { username: "scanner", password: "scanner123" },
    user: {
      userId: "user-scanner-001",
      profileId: "22222222-0000-0000-0000-000000000002",
      username: "scanner",
      role: "scanner",
      fullName: "Main Gate Security Staff",
      isActive: true,
      mustChangePassword: false,
    },
  },
  {
    credentials: { username: "student", password: "student123" },
    user: {
      userId: "user-student-001",
      profileId: "33333333-0000-0000-0000-000000000003",
      username: "student",
      role: "student",
      fullName: "Aarav Sharma",
      rollNumber: "23CS1001",
      category: "1st Year",
      department: "Computer Science & Engineering",
      isActive: true,
      mustChangePassword: false,
    },
  },
];

/**
 * Signs a session payload using HMAC-SHA256.
 */
export function signSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  });

  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the signature and decodes the session token.
 */
export function verifySessionToken(token: string): SessionUser | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  return decodeSessionToken(token);
}

/**
 * Sets the signed HTTP-only cookie on the current request/response.
 */
export async function setSessionCookie(user: SessionUser) {
  const token = signSessionToken(user);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Clears the session cookie.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Retrieves the currently logged-in user from request cookies.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;

  return verifySessionToken(sessionCookie.value);
}
