import { describe, it, expect } from "vitest";
import {
  createStudent,
  getStudentById,
  deleteStudent,
  authenticateStudent,
} from "../../lib/server/students";
import { getAuditLogs } from "../../lib/server/audit";

describe("Student Deletion & Cleanup", () => {
  const actorProfileId = "admin-test-profile-delete";

  it("successfully deletes a student and prevents further logins", async () => {
    // 1. Create a test student
    const rollNumber = `25DEL${Math.floor(1000 + Math.random() * 9000)}`;
    const { student, credentials } = await createStudent(
      {
        fullName: "Delete Test Student",
        rollNumber,
        category: "1st Year",
        department: "Mechanical Engineering",
        hostel: "CV Raman Hall (Hostel 1)",
      },
      actorProfileId
    );

    expect(student.id).toBeDefined();

    // Verify student exists and can log in
    const existing = await getStudentById(student.id);
    expect(existing).not.toBeNull();
    const authenticated = await authenticateStudent(credentials.username, credentials.hashCode);
    expect(authenticated).not.toBeNull();

    // 2. Delete the student
    const deleteResult = await deleteStudent(student.id, actorProfileId, "127.0.0.1");
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.id).toBe(student.id);

    // 3. Verify student no longer exists in lookup
    const deletedFetch = await getStudentById(student.id);
    expect(deletedFetch).toBeNull();

    // 4. Verify login fails
    const reAuth = await authenticateStudent(credentials.username, credentials.hashCode);
    expect(reAuth).toBeNull();

    // 5. Verify audit log was recorded
    const logs = await getAuditLogs({ entityType: "student", entityId: student.id });
    const deleteLog = logs.find((l) => l.action === "STUDENT_DELETED");
    expect(deleteLog).toBeDefined();
    expect(deleteLog?.actorProfileId).toBe(actorProfileId);
    expect(deleteLog?.metadata?.rollNumber).toBe(rollNumber);
  });
});
