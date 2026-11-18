import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/server/auth";
import {
  getStudentById,
  toggleStudentActive,
  updateStudent,
  deleteStudent,
} from "@/lib/server/students";

const PatchStudentSchema = z.object({
  isActive: z.boolean().optional(),
  department: z.string().optional(),
  hostel: z.string().optional(),
  phone: z.string().optional(),
  category: z.enum(["1st Year", "2nd Year", "3rd Year", "4th Year"]).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/students/[id]
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const student = await getStudentById(id);
    if (!student) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Student not found" } },
        { status: 404 }
      );
    }

    // Authorization: Admin can read all; student can read only their own
    if (user.role === "student" && user.profileId !== student.profileId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ student });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: err.code || "INTERNAL_ERROR", message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}

/**
 * PATCH /api/students/[id]
 * Updates editable fields or active status.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();

    const validation = PatchStudentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid payload" } },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    let updatedStudent = await getStudentById(id);

    if (!updatedStudent) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Student not found" } },
        { status: 404 }
      );
    }

    // Toggle active status if provided
    if (validation.data.isActive !== undefined) {
      updatedStudent = await toggleStudentActive(
        id,
        validation.data.isActive,
        admin.profileId,
        ip
      );
    }

    // Update non-identity fields if provided
    const { isActive: _, ...fieldUpdates } = validation.data;
    if (Object.keys(fieldUpdates).length > 0) {
      updatedStudent = await updateStudent(id, fieldUpdates, admin.profileId, ip);
    }

    return NextResponse.json({ success: true, student: updatedStudent });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: err.code || "INTERNAL_ERROR", message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}

/**
 * DELETE /api/students/[id]
 * Permanently removes a student record and linked account. Admin only.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireRole(["admin"]);
    const { id } = await params;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    const result = await deleteStudent(id, admin.profileId, ip);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: err.code || "INTERNAL_ERROR", message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
