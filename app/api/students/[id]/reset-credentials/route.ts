import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { resetStudentCredentials } from "@/lib/server/students";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/students/[id]/reset-credentials
 * Generates a new random CSPRNG hash code for the student, updates password hash,
 * bumps version, and returns new credentials ONCE.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireRole(["admin"]);
    const { id } = await params;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    const { username, hashCode } = await resetStudentCredentials(
      id,
      admin.profileId,
      ip
    );

    return NextResponse.json({
      success: true,
      credentials: {
        username,
        hashCode, // Displayed to the admin ONCE
      },
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message.includes("not found") ? 404 : 500);
    return NextResponse.json(
      { error: { code: err.code || "RESET_FAILED", message: err.message } },
      { status }
    );
  }
}
