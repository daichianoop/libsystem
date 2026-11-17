import { NextRequest, NextResponse } from "next/server";
import { HARDCODED_ACCOUNTS, setSessionCookie, SessionUser } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/server/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: { message: "Username and password are required" } },
        { status: 400 }
      );
    }

    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password).trim();

    // 1. Check Hardcoded Accounts First
    const match = HARDCODED_ACCOUNTS.find(
      (acc) =>
        acc.credentials.username.toLowerCase() === cleanUser &&
        acc.credentials.password === cleanPass
    );

    if (match) {
      await setSessionCookie(match.user);

      let redirectUrl = "/student/home";
      if (match.user.role === "admin") redirectUrl = "/admin/dashboard";
      if (match.user.role === "scanner") redirectUrl = "/scanner";

      return NextResponse.json({
        success: true,
        user: match.user,
        redirectUrl,
      });
    }

    // 2. Check Database if Supabase is connected
    try {
      const supabase = getAdminSupabase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, students(*)")
        .eq("username", cleanUser)
        .maybeSingle();

      if (profile) {
        // Build session user from DB
        const student = profile.students?.[0] || profile.students;
        const sessionUser: SessionUser = {
          userId: profile.id,
          profileId: profile.id,
          username: profile.username,
          role: profile.role,
          fullName: profile.full_name,
          rollNumber: student?.roll_number,
          category: student?.category,
          department: student?.department,
          isActive: profile.is_active,
          mustChangePassword: profile.must_change_password,
        };

        await setSessionCookie(sessionUser);

        let redirectUrl = "/student/home";
        if (sessionUser.role === "admin") redirectUrl = "/admin/dashboard";
        if (sessionUser.role === "scanner") redirectUrl = "/scanner";

        return NextResponse.json({
          success: true,
          user: sessionUser,
          redirectUrl,
        });
      }
    } catch {
      // If DB query fails or is offline, continue to rejection
    }

    return NextResponse.json(
      { error: { message: "Invalid username or password. Check credentials." } },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
