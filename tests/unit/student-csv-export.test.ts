import { describe, it, expect } from "vitest";
import { exportStudentsCSV, createStudent } from "../../lib/server/students";

describe("Phase 2: CSV Export", () => {
  it("generates valid RFC 4180 CSV with correct headers and sanitized fields", async () => {
    const csv = await exportStudentsCSV();

    const lines = csv.split("\r\n");
    expect(lines.length).toBeGreaterThan(40); // 40 students + header

    // Check header row
    const header = lines[0];
    expect(header).toContain("Roll Number");
    expect(header).toContain("Full Name");
    expect(header).toContain("Username");
    expect(header).toContain("Category");
    expect(header).toContain("Department");
    expect(header).toContain("In Library Status");

    // Plaintext passwords or secrets must NEVER be present in the CSV
    expect(csv).not.toContain("password");
    expect(csv).not.toContain("cardSecret");
    expect(csv).not.toContain("passwordHash");
  });

  it("respects filters when exporting CSV", async () => {
    const csvInLib = await exportStudentsCSV({ inLibrary: 1 });
    const lines = csvInLib.split("\r\n");

    // All data rows must have "1 (In Library)"
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        expect(lines[i]).toContain("1 (In Library)");
        expect(lines[i]).not.toContain("0 (Outside)");
      }
    }
  });
});
