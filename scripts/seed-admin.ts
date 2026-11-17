import { clerk } from "../lib/server/clerk";
import { getAdminSupabase } from "../lib/server/supabase";
import { env } from "../lib/env";

async function seedAdmin() {
  console.log("=== Seeding Initial System Administrator ===");

  const username = env.INITIAL_ADMIN_USERNAME || "admin.central";
  const password = env.INITIAL_ADMIN_PASSWORD || "AdminSecurePass#2026!";
  const fullName = "Central Library Administrator";

  try {
    const supabase = getAdminSupabase();

    // Check if admin already exists in Supabase profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      console.log(`[Info] Admin profile already exists in Supabase (id: ${existingProfile.id}, username: ${existingProfile.username}).`);
      return;
    }

    let clerkUser;
    // Check if user exists in Clerk
    const clerkUsers = await clerk.users.getUserList({ username: [username] });
    if (clerkUsers.data.length > 0) {
      clerkUser = clerkUsers.data[0];
      console.log(`[Info] Clerk user already exists: ${clerkUser.id}`);
    } else {
      console.log(`[Info] Creating Clerk user: ${username}...`);
      clerkUser = await clerk.users.createUser({
        username,
        password,
        firstName: "Central Library",
        lastName: "Administrator",
        publicMetadata: {
          role: "admin",
        },
        skipPasswordChecks: true,
      });
      console.log(`[Success] Clerk admin created successfully! ID: ${clerkUser.id}`);
    }

    // Insert into Supabase profiles
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        clerk_user_id: clerkUser.id,
        username,
        role: "admin",
        full_name: fullName,
        is_active: true,
        must_change_password: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[Error] Failed to insert admin into Supabase profiles:", error);
      return;
    }

    // Update clerk publicMetadata with profile_id
    await clerk.users.updateUser(clerkUser.id, {
      publicMetadata: {
        role: "admin",
        profile_id: profile.id,
      },
    });

    console.log("\n========================================================");
    console.log(" INITIAL ADMIN CREDENTIALS (SHOWN ONCE)");
    console.log("========================================================");
    console.log(` Username: ${username}`);
    console.log(` Password: ${password}`);
    console.log(" Rotate this password immediately after your first sign-in!");
    console.log("========================================================\n");
  } catch (err: any) {
    console.error("[Error] Seeding admin failed:", err?.message || err);
  }
}

seedAdmin();
