import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import {
  getStudentById,
  getStudentByRoll,
  getStudentCardSecret,
  updateStudentScanStatus,
  recordMovementEvent,
  getCheckpoints,
} from "@/lib/server/students";
import { verifyToken } from "@/lib/tag-token";
import { evaluateScanTransition, ScanMode } from "@/lib/server/state-machine";

export async function POST(req: NextRequest) {
  try {
    const scanner = await requireRole(["scanner", "admin"]);
    const body = await req.json();

    const { token, rollNumber, checkpointId = "cp-main", mode = "AUTO" } = body;

    if (!token && !rollNumber) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Token or roll number is required" } },
        { status: 400 }
      );
    }

    const checkpoints = await getCheckpoints();
    const checkpoint = checkpoints.find((cp) => cp.id === checkpointId) || checkpoints[0];

    let targetStudent = null;

    // 1. Resolve via Token
    if (token) {
      // Token format: v1.<student_id>.<bucket>.<hmac>
      const parts = String(token).trim().split(".");
      if (parts.length >= 4) {
        const studentId = parts[parts.length - 3] === "static" ? parts[2] : parts[1];
        const student = await getStudentById(studentId);
        if (student) {
          const cardSecret = await getStudentCardSecret(student.id);
          if (cardSecret) {
            const verification = verifyToken(token, cardSecret, undefined, student.credentialVersion);
            if (verification.valid) {
              targetStudent = student;
            } else {
              await recordMovementEvent({
                studentId: student.id,
                studentName: student.fullName,
                rollNumber: student.rollNumber,
                category: student.category,
                eventType: "REJECTED_SCAN",
                checkpointId: checkpoint.id,
                checkpointName: checkpoint.name,
                reasonCode: verification.errorCode || "INVALID_CARD",
                message: "Security tag validation failed (expired or tampered).",
              });

              return NextResponse.json({
                status: "REJECTED",
                reasonCode: verification.errorCode || "INVALID_CARD",
                message: "Security tag expired or invalid signature.",
              });
            }
          }
        }
      }
    }

    // 2. Resolve via Roll Number (Manual Fallback)
    if (!targetStudent && rollNumber) {
      targetStudent = await getStudentByRoll(rollNumber);
    }

    if (!targetStudent) {
      return NextResponse.json({
        status: "REJECTED",
        reasonCode: "UNKNOWN_STUDENT",
        message: "No registered student found matching this credential.",
      });
    }

    // 3. Compute debounce
    let secondsSinceLastScan: number | undefined = undefined;
    if (targetStudent.lastScanAt) {
      secondsSinceLastScan = Math.floor(
        (Date.now() - new Date(targetStudent.lastScanAt).getTime()) / 1000
      );
    }

    // 4. Run State Machine Transition
    const transition = evaluateScanTransition({
      currentInLibrary: targetStudent.inLibrary,
      checkpointType: checkpoint.type,
      checkpointIsActive: checkpoint.isActive,
      studentIsActive: targetStudent.isActive,
      scanMode: mode as ScanMode,
      secondsSinceLastScan,
      duplicateWindowSeconds: 10,
    });

    if (!transition.allowed) {
      await recordMovementEvent({
        studentId: targetStudent.id,
        studentName: targetStudent.fullName,
        rollNumber: targetStudent.rollNumber,
        category: targetStudent.category,
        eventType: "REJECTED_SCAN",
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.name,
        reasonCode: transition.reasonCode,
        message: transition.message,
      });

      return NextResponse.json({
        status: transition.reasonCode === "DUPLICATE_SCAN" ? "DUPLICATE" : "REJECTED",
        reasonCode: transition.reasonCode,
        message: transition.message,
        student: targetStudent,
      });
    }

    // 5. Success Transition: Update Student & Log Event
    const updatedStudent = await updateStudentScanStatus(
      targetStudent.id,
      transition.targetInLibrary
    );

    const event = await recordMovementEvent({
      studentId: updatedStudent.id,
      studentName: updatedStudent.fullName,
      rollNumber: updatedStudent.rollNumber,
      category: updatedStudent.category,
      eventType: transition.eventType as "LIBRARY_ENTRY" | "LIBRARY_EXIT",
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      reasonCode: transition.reasonCode,
      message: transition.message,
    });

    return NextResponse.json({
      status: "ACCEPTED",
      eventType: transition.eventType,
      targetInLibrary: transition.targetInLibrary,
      message: transition.message,
      student: updatedStudent,
      checkpoint,
      event,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: err.code || "SCAN_ERROR", message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
