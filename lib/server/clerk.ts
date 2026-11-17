import { createClerkClient } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

export const clerk = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
});

export interface CreateClerkUserInput {
  username: string;
  password: string; // The generated hashcode
  role: "admin" | "scanner" | "student" | "warden";
  profileId: string;
  fullName: string;
}

/**
 * Creates a restricted Clerk user with username and password.
 * Attaches role and profile_id into publicMetadata.
 */
export async function createClerkUser(input: CreateClerkUserInput) {
  const user = await clerk.users.createUser({
    username: input.username,
    password: input.password,
    firstName: input.fullName.split(" ")[0] || input.fullName,
    lastName: input.fullName.split(" ").slice(1).join(" ") || undefined,
    publicMetadata: {
      role: input.role,
      profile_id: input.profileId,
    },
    skipPasswordChecks: true,
  });

  return user;
}

/**
 * Updates a user's password (e.g. on Admin credential reset).
 */
export async function resetClerkUserPassword(clerkUserId: string, newPassword: string) {
  return await clerk.users.updateUser(clerkUserId, {
    password: newPassword,
    skipPasswordChecks: true,
  });
}

/**
 * Activates or deactivates a user in Clerk (lockout / unlock).
 */
export async function setClerkUserLockStatus(clerkUserId: string, locked: boolean) {
  if (locked) {
    return await clerk.users.banUser(clerkUserId);
  } else {
    return await clerk.users.unbanUser(clerkUserId);
  }
}

/**
 * Deletes a Clerk user (used for rollback if DB transaction fails during registration).
 */
export async function deleteClerkUser(clerkUserId: string) {
  try {
    return await clerk.users.deleteUser(clerkUserId);
  } catch (err) {
    console.error(`Failed to delete Clerk user during rollback: ${clerkUserId}`, err);
  }
}
