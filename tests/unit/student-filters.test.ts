import { describe, it, expect } from "vitest";
import { listStudents } from "../../lib/server/students";

describe("Phase 2: Combinable Admin Student Filters & Pagination", () => {
  it("returns 40 seeded demo students with counts", async () => {
    const result = await listStudents({ page: 1, pageSize: 50 });
    expect(result.total).toBeGreaterThanOrEqual(40);
    expect(result.counts.total).toBeGreaterThanOrEqual(40);
    expect(result.counts.inLibrary).toBeGreaterThan(0);
    expect(result.counts.outside).toBeGreaterThan(0);
    expect(result.counts.inLibrary + result.counts.outside).toBe(result.counts.total);
  });

  it("filters accurately by category (single and multi-select)", async () => {
    // Single category
    const y1Result = await listStudents({ category: ["1st Year"], pageSize: 50 });
    expect(y1Result.students.length).toBeGreaterThan(0);
    y1Result.students.forEach((s) => {
      expect(s.category).toBe("1st Year");
    });

    // Multi category
    const multiResult = await listStudents({ category: ["2nd Year", "3rd Year"], pageSize: 50 });
    expect(multiResult.students.length).toBeGreaterThan(0);
    multiResult.students.forEach((s) => {
      expect(["2nd Year", "3rd Year"]).toContain(s.category);
    });
  });

  it("filters accurately by in_library status (0 vs 1)", async () => {
    // Only students currently in library
    const inLib = await listStudents({ inLibrary: 1, pageSize: 50 });
    expect(inLib.students.length).toBeGreaterThan(0);
    inLib.students.forEach((s) => {
      expect(s.inLibrary).toBe(1);
    });

    // Only students outside
    const outside = await listStudents({ inLibrary: 0, pageSize: 50 });
    expect(outside.students.length).toBeGreaterThan(0);
    outside.students.forEach((s) => {
      expect(s.inLibrary).toBe(0);
    });
  });

  it("filters accurately by department", async () => {
    const dept = "Computer Science & Engineering";
    const result = await listStudents({ department: dept, pageSize: 50 });
    expect(result.students.length).toBeGreaterThan(0);
    result.students.forEach((s) => {
      expect(s.department).toBe(dept);
    });
  });

  it("filters by fuzzy free-text search (q) across name, roll, and username", async () => {
    // Search by name part
    const searchByName = await listStudents({ q: "sharma" });
    expect(searchByName.students.length).toBeGreaterThan(0);
    searchByName.students.forEach((s) => {
      const match =
        s.fullName.toLowerCase().includes("sharma") ||
        s.rollNumber.toLowerCase().includes("sharma") ||
        s.username.toLowerCase().includes("sharma");
      expect(match).toBe(true);
    });

    // Search by roll prefix
    const searchByRoll = await listStudents({ q: "24CS" });
    searchByRoll.students.forEach((s) => {
      expect(s.rollNumber.includes("24CS") || s.username.includes("24cs")).toBe(true);
    });
  });

  it("combines multiple filters simultaneously", async () => {
    const combined = await listStudents({
      category: ["1st Year", "2nd Year"],
      inLibrary: 0,
      department: "Computer Science & Engineering",
    });

    combined.students.forEach((s) => {
      expect(["1st Year", "2nd Year"]).toContain(s.category);
      expect(s.inLibrary).toBe(0);
      expect(s.department).toBe("Computer Science & Engineering");
    });
  });

  it("supports sorting and server pagination", async () => {
    // Sort by name ascending
    const ascResult = await listStudents({ sortBy: "name", sortOrder: "asc", page: 1, pageSize: 5 });
    expect(ascResult.students.length).toBe(5);
    expect(ascResult.page).toBe(1);
    expect(ascResult.pageSize).toBe(5);
    expect(ascResult.totalPages).toBeGreaterThan(1);

    // Verify alphabetical ordering
    for (let i = 0; i < ascResult.students.length - 1; i++) {
      expect(
        ascResult.students[i].fullName.localeCompare(ascResult.students[i + 1].fullName)
      ).toBeLessThanOrEqual(0);
    }

    // Page 2
    const page2Result = await listStudents({ sortBy: "name", sortOrder: "asc", page: 2, pageSize: 5 });
    expect(page2Result.students.length).toBe(5);
    expect(page2Result.page).toBe(2);
    expect(page2Result.students[0].id).not.toBe(ascResult.students[0].id);
  });
});
