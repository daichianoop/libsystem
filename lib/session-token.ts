export type UserRole = "admin" | "scanner" | "student" | "warden";

export const SESSION_COOKIE_NAME = "pass_session";

export interface SessionUser {
  userId: string;
  profileId: string;
  username: string;
  role: UserRole;
  fullName: string;
  rollNumber?: string;
  category?: "1st Year" | "2nd Year" | "3rd Year" | "4th Year";
  department?: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

/**
 * Universal payload decoder that works across Edge middleware and Node servers.
 * Pure base64url decoding without Node.js 'crypto' imports.
 */
export function decodeSessionToken(token: string): SessionUser | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload] = parts;

  try {
    const raw = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const data = JSON.parse(raw);

    // Expiry check
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      userId: data.userId,
      profileId: data.profileId,
      username: data.username,
      role: data.role,
      fullName: data.fullName,
      rollNumber: data.rollNumber,
      category: data.category,
      department: data.department,
      isActive: data.isActive ?? true,
      mustChangePassword: data.mustChangePassword ?? false,
    };
  } catch {
    return null;
  }
}
