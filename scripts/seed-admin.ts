import { getAdminSupabase } from "../lib/server/supabase";
import { env } from "../lib/env";

async function seedAdmin() {
  console.log("=== Seeding Initial System Administrator (Local / DB) ===");

  const username = env.INITIAL_ADMIN_USERNAME || "admin";
  const password = env.INITIAL_ADMIN_PASSWORD || "admin123";
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
      console.log(`[Info] Admin profile already exists in database (id: ${existingProfile.id}, username: ${existingProfile.username}).`);
      console.log(`Username: ${existingProfile.username} | Password: ${password}`);
      return;
    }

    const clerkUserId = `local_admin_${Date.now()}`;

    // Insert into Supabase profiles
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        clerk_user_id: clerkUserId,
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

    console.log("\n========================================================");
    console.log(" INITIAL ADMIN CREDENTIALS");
    console.log("========================================================");
    console.log(` Username: ${username}`);
    console.log(` Password: ${password}`);
    console.log("========================================================\n");
  } catch (err: any) {
    console.error("[Error] Seeding admin failed:", err?.message || err);
  }
}

seedAdmin();
