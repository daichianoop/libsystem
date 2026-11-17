import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import {
  listStudents,
  createStudent,
  StudentCategory,
} from "@/lib/server/students";

const CreateStudentSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  rollNumber: z.string().min(3, "Roll number must be at least 3 characters"),
  category: z.enum(["1st Year", "2nd Year", "3rd Year", "4th Year"] as const),
  department: z.string().min(2, "Department is required"),
  hostel: z.string().optional(),
  phone: z.string().optional(),
  guardianContact: z.string().optional(),
});

/**
 * GET /api/students
 * Admin view: lists students with combinable filters and server pagination.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole(["admin"]);

    const { searchParams } = new URL(req.url);

    // Multi-select categories support
    const rawCategories = searchParams.getAll("category");
    let category: string[] | undefined = undefined;
    if (rawCategories.length > 0) {
      // Could be comma-separated or repeated params
      category = rawCategories.flatMap((c) => c.split(",")).filter(Boolean);
    }

    // in_library filter: "0" | "1"
    const inLibParam = searchParams.get("in_library");
    let inLibrary: 0 | 1 | undefined = undefined;
    if (inLibParam === "0" || inLibParam === "1") {
      inLibrary = Number(inLibParam) as 0 | 1;
    }

    // active status: "true" | "false"
    const activeParam = searchParams.get("active");
    let isActive: boolean | undefined = undefined;
    if (activeParam === "true") isActive = true;
    if (activeParam === "false") isActive = false;

    const department = searchParams.get("department") || undefined;
    const q = searchParams.get("q") || undefined;
    const lastScanFrom = searchParams.get("lastScanFrom") || undefined;
    const lastScanTo = searchParams.get("lastScanTo") || undefined;

    const sortBy = (searchParams.get("sortBy") as any) || "name";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "asc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

    const result = await listStudents({
      category,
      inLibrary,
      department,
      isActive,
      q,
      lastScanFrom,
      lastScanTo,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });

    return NextResponse.json({
      data: result.students,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
      counts: result.counts,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: { code: err.code || "INTERNAL_ERROR", message: err.message || "An error occurred" } },
      { status }
    );
  }
}

/**
 * POST /api/students
 * Admin view: registers a new student, generates username + high-entropy hash code,
 * writes audit log, and returns credentials ONCE.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(["admin"]);
    const body = await req.json();

    const validation = CreateStudentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation error",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    const { student, credentials } = await createStudent(
      {
        fullName: validation.data.fullName,
        rollNumber: validation.data.rollNumber,
        category: validation.data.category as StudentCategory,
        department: validation.data.department,
        hostel: validation.data.hostel,
        phone: validation.data.phone,
        guardianContact: validation.data.guardianContact,
      },
      admin.profileId,
      ip
    );

    return NextResponse.json(
      {
        success: true,
        student,
        credentials, // Returned ONCE to the admin UI
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err.statusCode || (err.message.includes("already registered") ? 409 : 500);
    return NextResponse.json(
      { error: { code: err.code || "REGISTRATION_ERROR", message: err.message || "Registration failed" } },
      { status }
    );
  }
}
