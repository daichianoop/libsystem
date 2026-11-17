import { describe, it, expect } from "vitest";
import {
  createStudent,
  updateStudentScanStatus,
  getStudentCardSecret,
  getStudentById,
  getStudentByRoll,
} from "../../lib/server/students";
import { generateRotatingToken, getCurrentBucket } from "../../lib/tag-token";
import { evaluateScanTransition } from "../../lib/server/state-machine";

describe("Scanner & Rotating Token State Transitions", () => {
  it("transitions student 0 -> 1 on entry, and 1 -> 0 on exit", async () => {
    const rollNumber = `25SC${Math.floor(1000 + Math.random() * 9000)}`;
    const { student } = await createStudent(
      {
        fullName: "Saurabh Ganguly",
        rollNumber,
        category: "3rd Year",
        department: "Computer Science & Engineering",
      },
      "admin-scanner-test"
    );

    expect(student.inLibrary).toBe(0);

    // 1. Entry Transition
    const entryTransition = evaluateScanTransition({
      currentInLibrary: student.inLibrary,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: true,
      scanMode: "AUTO",
    });

    expect(entryTransition.allowed).toBe(true);
    expect(entryTransition.targetInLibrary).toBe(1);
    expect(entryTransition.eventType).toBe("LIBRARY_ENTRY");

    // Apply entry
    const enteredStudent = await updateStudentScanStatus(student.id, entryTransition.targetInLibrary);
    expect(enteredStudent.inLibrary).toBe(1);

    // 2. Exit Transition
    const exitTransition = evaluateScanTransition({
      currentInLibrary: enteredStudent.inLibrary,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: true,
      scanMode: "AUTO",
      secondsSinceLastScan: 15, // Past 10s debounce
    });

    expect(exitTransition.allowed).toBe(true);
    expect(exitTransition.targetInLibrary).toBe(0);
    expect(exitTransition.eventType).toBe("LIBRARY_EXIT");

    // Apply exit
    const exitedStudent = await updateStudentScanStatus(student.id, exitTransition.targetInLibrary);
    expect(exitedStudent.inLibrary).toBe(0);
  });

  it("guards against duplicate scans within 10 seconds", () => {
    const debounceResult = evaluateScanTransition({
      currentInLibrary: 0,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: true,
      secondsSinceLastScan: 4, // within 10s
      duplicateWindowSeconds: 10,
    });

    expect(debounceResult.allowed).toBe(false);
    expect(debounceResult.reasonCode).toBe("DUPLICATE_SCAN");
  });

  it("generates and verifies dynamic rotating tokens", () => {
    const studentId = "student-test-uuid";
    const cardSecret = "secret-key-1234567890abcdef";
    const bucket = getCurrentBucket();

    const token = generateRotatingToken(studentId, cardSecret, bucket);
    expect(token).toMatch(/^v1\.student-test-uuid\.\d+\.[a-f0-9]{64}$/);
  });
});
