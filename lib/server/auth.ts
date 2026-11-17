import { auth, currentUser } from "@clerk/nextjs/server";
import { getAdminSupabase } from "./supabase";

export type UserRole = "admin" | "scanner" | "student" | "warden";

export interface AuthenticatedUser {
  clerkUserId: string;
  profileId: string;
  username: string;
  role: UserRole;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

export class AuthError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 401, code: string = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Retrieves the current authenticated user and their Supabase profile.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session || !session.userId) {
    return null;
  }

  const supabase = getAdminSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, clerk_user_id, username, role, full_name, is_active, must_change_password")
    .eq("clerk_user_id", session.userId)
    .single();

  if (error || !profile) {
    // If not in DB yet, fallback to Clerk metadata
    const roleFromMeta = (session.sessionClaims?.metadata as any)?.role || "student";
    return {
      clerkUserId: session.userId,
      profileId: (session.sessionClaims?.metadata as any)?.profile_id || "",
      username: "",
      role: roleFromMeta as UserRole,
      fullName: "",
      isActive: true,
      mustChangePassword: false,
    };
  }

  return {
    clerkUserId: profile.clerk_user_id,
    profileId: profile.id,
    username: profile.username,
    role: profile.role as UserRole,
    fullName: profile.full_name,
    isActive: profile.is_active,
    mustChangePassword: profile.must_change_password,
  };
}

/**
 * Asserts the request has a valid authenticated session.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentication required", 401, "UNAUTHENTICATED");
  }
  if (!user.isActive) {
    throw new AuthError("Account is inactive or suspended", 403, "ACCOUNT_INACTIVE");
  }
  return user;
}

/**
 * Asserts that the authenticated user has one of the allowed roles.
 * Never trusts role sent by the client.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Access denied. Required roles: ${allowedRoles.join(", ")}; current role: ${user.role}`,
      403,
      "FORBIDDEN"
    );
  }
  return user;
}
