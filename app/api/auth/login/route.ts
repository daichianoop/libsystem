import { NextRequest, NextResponse } from "next/server";
import { HARDCODED_ACCOUNTS, setSessionCookie, SessionUser } from "@/lib/server/session";
import { authenticateStudent } from "@/lib/server/students";
import { getAdminSupabase } from "@/lib/server/supabase";
import { verifyPassword } from "@/lib/server/passwords";

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

    // 1. Check Hardcoded Accounts First (for instant demo accounts)
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

    // 2. Check Supabase Database first
    try {
      const supabase = getAdminSupabase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, students(*)")
        .eq("username", cleanUser)
        .maybeSingle();

      if (profile && profile.is_active) {
        let passwordMatches = false;

        // If password_hash is stored in Supabase, verify it
        if (profile.password_hash) {
          passwordMatches = verifyPassword(cleanPass, profile.password_hash);
        } else if (
          (profile.role === "admin" && cleanPass === "admin123") ||
          (profile.role === "scanner" && cleanPass === "scanner123") ||
          (profile.role === "student" && (cleanPass === "student123" || cleanPass === "pass123456"))
        ) {
          passwordMatches = true;
        }

        if (passwordMatches) {
          const std = Array.isArray(profile.students) ? profile.students[0] : profile.students;
          const sessionUser: SessionUser = {
            userId: profile.id,
            profileId: profile.id,
            username: profile.username,
            role: profile.role,
            fullName: profile.full_name,
            rollNumber: std?.roll_number,
            category: std?.category,
            department: std?.department,
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
      }
    } catch {
      // Supabase is offline or not configured
    }

    // 3. Check Student Store / Registered Students fallback
    const student = await authenticateStudent(cleanUser, cleanPass);
    if (student) {
      const sessionUser: SessionUser = {
        userId: student.profileId,
        profileId: student.profileId,
        username: student.username,
        role: "student",
        fullName: student.fullName,
        rollNumber: student.rollNumber,
        category: student.category,
        department: student.department,
        isActive: student.isActive,
        mustChangePassword: false,
      };

      await setSessionCookie(sessionUser);

      return NextResponse.json({
        success: true,
        user: sessionUser,
        redirectUrl: "/student/home",
      });
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
