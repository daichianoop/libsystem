import { describe, it, expect } from "vitest";
import {
  createStudent,
  resetStudentCredentials,
  toggleStudentActive,
  authenticateStudent,
  getStudentById,
} from "../../lib/server/students";
import { getAuditLogs } from "../../lib/server/audit";

describe("Phase 2: Credential Reset & Activation Controls", () => {
  const adminId = "admin-test-profile-002";

  it("resets credentials: old password stops working, new password authenticates", async () => {
    const rollNumber = `25BT${Math.floor(1000 + Math.random() * 9000)}`;
    const { student, credentials: initialCreds } = await createStudent(
      {
        fullName: "Vikram Seth",
        rollNumber,
        category: "2nd Year",
        department: "Information Technology",
      },
      adminId
    );

    // Initial auth works
    expect(await authenticateStudent(initialCreds.username, initialCreds.hashCode)).not.toBeNull();

    // Admin resets credentials
    const resetResult = await resetStudentCredentials(student.id, adminId, "10.0.0.1");

    expect(resetResult.username).toBe(initialCreds.username);
    expect(resetResult.hashCode).not.toBe(initialCreds.hashCode);
    expect(resetResult.hashCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // Old password fails immediately
    const oldAuth = await authenticateStudent(initialCreds.username, initialCreds.hashCode);
    expect(oldAuth).toBeNull();

    // New password succeeds
    const newAuth = await authenticateStudent(initialCreds.username, resetResult.hashCode);
    expect(newAuth).not.toBeNull();
    expect(newAuth?.rollNumber).toBe(rollNumber);

    // Credential version bumped
    const updatedStudent = await getStudentById(student.id);
    expect(updatedStudent?.credentialVersion).toBe(2);

    // Audit log recorded
    const logs = await getAuditLogs({
      entityType: "student",
      entityId: student.id,
      action: "CREDENTIALS_RESET",
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs[0].metadata)).not.toContain(resetResult.hashCode);
  });

  it("enforces account activation / deactivation gating", async () => {
    const rollNumber = `25CH${Math.floor(1000 + Math.random() * 9000)}`;
    const { student, credentials } = await createStudent(
      {
        fullName: "Anurag Kashyap",
        rollNumber,
        category: "4th Year",
        department: "Mechanical Engineering",
      },
      adminId
    );

    // Active by default
    expect(await authenticateStudent(credentials.username, credentials.hashCode)).not.toBeNull();

    // Deactivate student
    const deactivated = await toggleStudentActive(student.id, false, adminId);
    expect(deactivated.isActive).toBe(false);

    // Inactive student cannot authenticate
    const suspendedAuth = await authenticateStudent(credentials.username, credentials.hashCode);
    expect(suspendedAuth).toBeNull();

    // Re-activate student
    const reactivated = await toggleStudentActive(student.id, true, adminId);
    expect(reactivated.isActive).toBe(true);

    // Active student can authenticate again
    const resumedAuth = await authenticateStudent(credentials.username, credentials.hashCode);
    expect(resumedAuth).not.toBeNull();
  });
});
