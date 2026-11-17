import { describe, it, expect, beforeEach } from "vitest";
import {
  createStudent,
  getStudentById,
  authenticateStudent,
  StudentRecord,
} from "../../lib/server/students";
import { getAuditLogs } from "../../lib/server/audit";

describe("Phase 2: Student Registration & Credential Issuance", () => {
  const actorProfileId = "admin-test-profile-001";

  it("registers a student and returns credentials { username, hashCode } exactly once", async () => {
    const rollNumber = `25CS${Math.floor(1000 + Math.random() * 9000)}`;
    const result = await createStudent(
      {
        fullName: "Priyanka Sharma",
        rollNumber,
        category: "1st Year",
        department: "Computer Science & Engineering",
        hostel: "Sarojini Naidu Hall (Hostel 3)",
      },
      actorProfileId
    );

    // Assert return shape
    expect(result.student).toBeDefined();
    expect(result.credentials).toBeDefined();
    expect(result.credentials.username).toMatch(/^priyanka\.sharma\d{3,4}/);
    expect(result.credentials.hashCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // Plaintext hash code must NOT be on the student record
    expect((result.student as any).passwordHash).toBeUndefined();
    expect((result.student as any).hashCode).toBeUndefined();
    expect((result.student as any).cardSecret).toBeUndefined();

    // Verify student is saved in store
    const fetched = await getStudentById(result.student.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.fullName).toBe("Priyanka Sharma");
    expect(fetched?.inLibrary).toBe(0); // Starts outside library
    expect((fetched as any).hashCode).toBeUndefined();
    expect((fetched as any).passwordHash).toBeUndefined();
  });

  it("allows newly registered student to log in with returned { username, hashCode }", async () => {
    const rollNumber = `25EE${Math.floor(1000 + Math.random() * 9000)}`;
    const { credentials } = await createStudent(
      {
        fullName: "Tarun Reddy",
        rollNumber,
        category: "2nd Year",
        department: "Electrical & Electronics",
      },
      actorProfileId
    );

    // Authenticate with generated credentials
    const authed = await authenticateStudent(credentials.username, credentials.hashCode);
    expect(authed).not.toBeNull();
    expect(authed?.rollNumber).toBe(rollNumber);

    // Wrong password must fail
    const failedAuth = await authenticateStudent(credentials.username, "WRONG-PASS-1234");
    expect(failedAuth).toBeNull();
  });

  it("resolves username collision by appending random alphanumeric suffix", async () => {
    const rollNumber1 = `25ME${Math.floor(1000 + Math.random() * 4000)}`;
    const rollNumber2 = `25ME${Math.floor(5000 + Math.random() * 4000)}`;

    const first = await createStudent(
      {
        fullName: "Amitabh Sen",
        rollNumber: rollNumber1,
        category: "3rd Year",
        department: "Mechanical Engineering",
      },
      actorProfileId
    );

    // Force collision by giving identical name and suffix
    const second = await createStudent(
      {
        fullName: "Amitabh Sen",
        rollNumber: rollNumber2,
        category: "3rd Year",
        department: "Mechanical Engineering",
      },
      actorProfileId
    );

    expect(first.credentials.username).not.toEqual(second.credentials.username);
    expect(second.credentials.username.length).toBeLessThanOrEqual(24);
  });

  it("rejects duplicate roll number registration", async () => {
    const rollNumber = `25CV${Math.floor(1000 + Math.random() * 9000)}`;

    await createStudent(
      {
        fullName: "Sanjay Singhania",
        rollNumber,
        category: "4th Year",
        department: "Civil Engineering",
      },
      actorProfileId
    );

    // Duplicate attempt
    await expect(
      createStudent(
        {
          fullName: "Another Student",
          rollNumber,
          category: "4th Year",
          department: "Civil Engineering",
        },
        actorProfileId
      )
    ).rejects.toThrow(/already registered/);
  });

  it("logs immutable audit event without plaintext hash code", async () => {
    const rollNumber = `25IT${Math.floor(1000 + Math.random() * 9000)}`;
    const result = await createStudent(
      {
        fullName: "Kriti Sanon",
        rollNumber,
        category: "1st Year",
        department: "Information Technology",
      },
      actorProfileId,
      "192.168.1.100"
    );

    const auditLogs = await getAuditLogs({
      entityType: "student",
      entityId: result.student.id,
      action: "STUDENT_REGISTERED",
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    const entry = auditLogs[0];
    expect(entry.actorProfileId).toBe(actorProfileId);
    expect(entry.ip).toBe("192.168.1.100");
    expect(entry.metadata.username).toBe(result.credentials.username);

    // Plaintext password / hashCode must never appear in audit logs
    expect(JSON.stringify(entry.metadata)).not.toContain(result.credentials.hashCode);
    expect(entry.metadata.hashCode).toBeUndefined();
    expect(entry.metadata.password).toBeUndefined();
  });
});
