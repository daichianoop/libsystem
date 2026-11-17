import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { exportStudentsCSV } from "@/lib/server/students";
import { logAuditEvent } from "@/lib/server/audit";

/**
 * GET /api/export/students
 * Exports filtered students list as a downloadable CSV file.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireRole(["admin"]);
    const { searchParams } = new URL(req.url);

    const rawCategories = searchParams.getAll("category");
    let category: string[] | undefined = undefined;
    if (rawCategories.length > 0) {
      category = rawCategories.flatMap((c) => c.split(",")).filter(Boolean);
    }

    const inLibParam = searchParams.get("in_library");
    let inLibrary: 0 | 1 | undefined = undefined;
    if (inLibParam === "0" || inLibParam === "1") {
      inLibrary = Number(inLibParam) as 0 | 1;
    }

    const activeParam = searchParams.get("active");
    let isActive: boolean | undefined = undefined;
    if (activeParam === "true") isActive = true;
    if (activeParam === "false") isActive = false;

    const department = searchParams.get("department") || undefined;
    const q = searchParams.get("q") || undefined;
    const lastScanFrom = searchParams.get("lastScanFrom") || undefined;
    const lastScanTo = searchParams.get("lastScanTo") || undefined;

    const csvData = await exportStudentsCSV({
      category,
      inLibrary,
      department,
      isActive,
      q,
      lastScanFrom,
      lastScanTo,
      sortBy: "name",
      sortOrder: "asc",
    });

    // Audit log the export
    await logAuditEvent({
      actorProfileId: admin.profileId,
      action: "EXPORT_STUDENTS_CSV",
      entityType: "student",
      metadata: {
        filterCategory: category,
        filterInLibrary: inLibrary,
        filterDepartment: department,
      },
      ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `students-export-${dateStr}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: { code: err.code || "EXPORT_FAILED", message: err.message } },
      { status }
    );
  }
}
