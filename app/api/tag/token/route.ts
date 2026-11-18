import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import {
  getStudentById,
  getStudentCardSecret,
  listStudents,
} from "@/lib/server/students";
import {
  generateRotatingToken,
  getCurrentBucket,
  BUCKET_DURATION_SECONDS,
} from "@/lib/tag-token";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Find student record matching user's profile
    const all = await listStudents({ pageSize: 100 });
    let student = all.students.find(
      (s) => s.profileId === user.profileId || s.username === user.username
    );

    // If admin is testing or student not found, pick first student
    if (!student && all.students.length > 0) {
      student = all.students[0];
    }

    if (!student) {
      return NextResponse.json(
        { error: { message: "No student profile associated with this account." } },
        { status: 404 }
      );
    }

    const cardSecret = (await getStudentCardSecret(student.id)) || "fallback_secret_key_student_tag";
    const bucket = getCurrentBucket();
    const token = generateRotatingToken(student.id, cardSecret, bucket);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresInSeconds = BUCKET_DURATION_SECONDS - (nowSeconds % BUCKET_DURATION_SECONDS);

    return NextResponse.json({
      token,
      bucket,
      expiresInSeconds,
      student: {
        id: student.id,
        fullName: student.fullName,
        rollNumber: student.rollNumber,
        category: student.category,
        department: student.department,
        inLibrary: student.inLibrary,
        lastScanAt: student.lastScanAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message || "Failed to issue tag token." } },
      { status: err.statusCode || 500 }
    );
  }
}
