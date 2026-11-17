export interface CreateClerkUserInput {
  username: string;
  password: string;
  role: "admin" | "scanner" | "student" | "warden";
  profileId: string;
  fullName: string;
}

/**
 * Local auth mock adapter (Clerk removed)
 */
export const clerk = {
  users: {
    createUser: async (input: any) => ({
      id: `local_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      publicMetadata: input.publicMetadata,
    }),
    updateUser: async (id: string, input: any) => ({
      id,
      ...input,
    }),
    getUserList: async (_query?: any) => ({
      data: [],
      totalCount: 0,
    }),
    banUser: async (id: string) => ({ id, banned: true }),
    unbanUser: async (id: string) => ({ id, banned: false }),
    deleteUser: async (id: string) => ({ id, deleted: true }),
  },
};

export async function createClerkUser(input: CreateClerkUserInput) {
  return await clerk.users.createUser({
    username: input.username,
    password: input.password,
    firstName: input.fullName.split(" ")[0],
    lastName: input.fullName.split(" ").slice(1).join(" "),
    publicMetadata: {
      role: input.role,
      profile_id: input.profileId,
    },
  });
}

export async function resetClerkUserPassword(_clerkUserId: string, _newPassword: string) {
  return { success: true };
}

export async function setClerkUserLockStatus(_clerkUserId: string, _locked: boolean) {
  return { success: true };
}

export async function deleteClerkUser(_clerkUserId: string) {
  return { success: true };
}
