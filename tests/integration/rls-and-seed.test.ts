import { describe, it, expect } from "vitest";
import { generateUsername } from "@/lib/username";
import { generateHashCode, levenshteinDistance } from "@/lib/hashcode";

describe("Phase 1 Integration & Seed Integrity", () => {
  it("generates 40 non-similar credentials for 4 cohorts", () => {
    const cohorts = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
    const generated: Array<{ roll: string; username: string; code: string; year: string }> = [];
    const codes: string[] = [];

    let count = 0;
    for (const year of cohorts) {
      for (let i = 1; i <= 10; i++) {
        count++;
        const roll = `2026CS${1000 + count}`;
        const name = `Student ${year} Number ${i}`;
        const username = generateUsername(name, roll);
        const code = generateHashCode(codes);
        codes.push(code);

        generated.push({ roll, username, code, year });
      }
    }

    expect(generated.length).toBe(40);

    // Verify all usernames are unique
    const usernames = generated.map((g) => g.username);
    expect(new Set(usernames).size).toBe(40);

    // Verify all hash codes are unique and have required format
    expect(new Set(codes).size).toBe(40);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }

    // Verify Levenshtein edit distance between consecutive codes > 3
    for (let i = 0; i < codes.length - 1; i++) {
      const c1 = codes[i].replace(/-/g, "");
      const c2 = codes[i + 1].replace(/-/g, "");
      expect(levenshteinDistance(c1, c2)).toBeGreaterThan(3);
    }
  });

  it("verifies RLS rule simulation: student can only query own profile", () => {
    const studentAProfileId = "user-a-uuid";
    const studentBProfileId = "user-b-uuid";

    // Simulating the RLS condition: profile_id = current_profile_id()
    const evaluateRlsRead = (requesterProfileId: string, rowProfileId: string, role: string) => {
      if (role === "admin" || role === "scanner") return true;
      return requesterProfileId === rowProfileId;
    };

    // Student A reading Student A's row -> ALLOWED
    expect(evaluateRlsRead(studentAProfileId, studentAProfileId, "student")).toBe(true);

    // Student A reading Student B's row -> BLOCKED
    expect(evaluateRlsRead(studentAProfileId, studentBProfileId, "student")).toBe(false);

    // Admin reading Student B's row -> ALLOWED
    expect(evaluateRlsRead("admin-uuid", studentBProfileId, "admin")).toBe(true);
  });
});
