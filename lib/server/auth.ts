import { getSessionUser, SessionUser } from "./session";

export type UserRole = "admin" | "scanner" | "student" | "warden";

export interface AuthenticatedUser extends SessionUser {}

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
 * Retrieves the current authenticated user from the active session.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return await getSessionUser();
}

/**
 * Asserts the request has an active authenticated session.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentication required. Please sign in.", 401, "UNAUTHENTICATED");
  }
  if (!user.isActive) {
    throw new AuthError("Account is inactive or suspended", 403, "ACCOUNT_INACTIVE");
  }
  return user;
}

/**
 * Asserts that the authenticated user possesses one of the allowed roles.
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
