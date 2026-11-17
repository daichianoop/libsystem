import { describe, it, expect } from "vitest";
import {
  generateHashCode,
  HASHCODE_ALPHABET,
  hasRunOrRepetition,
  levenshteinDistance,
} from "@/lib/hashcode";

describe("Hash Code (Initial Password) Generator", () => {
  it("generates 12-character codes formatted as XXXX-XXXX-XXXX", () => {
    const code = generateHashCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(code.replace(/-/g, "").length).toBe(12);
  });

  it("never contains ambiguous characters (0, O, 1, I, l)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateHashCode();
      expect(code).not.toMatch(/[0O1Il]/);
      const clean = code.replace(/-/g, "");
      for (const char of clean) {
        expect(HASHCODE_ALPHABET).toContain(char);
      }
    }
  });

  it("detects 3+ identical consecutive characters or sequential runs", () => {
    expect(hasRunOrRepetition("AAA999234567")).toBe(true);
    expect(hasRunOrRepetition("ABC456789XYZ")).toBe(true);
    expect(hasRunOrRepetition("789KMNPQRSTU")).toBe(true);
    expect(hasRunOrRepetition("K7QM3XRT9WPD")).toBe(false);
  });

  it("calculates Levenshtein distance correctly", () => {
    expect(levenshteinDistance("K7QM", "K7QM")).toBe(0);
    expect(levenshteinDistance("K7QM", "K7QA")).toBe(1);
    expect(levenshteinDistance("AAAA", "BBBB")).toBe(4);
  });

  it("rejects codes within edit distance <= 3 from existing batch codes", () => {
    const existing = ["K7QM-3XRT-9WPD"];
    const code = generateHashCode(existing);
    const cleanExisting = existing[0].replace(/-/g, "");
    const cleanCode = code.replace(/-/g, "");

    expect(levenshteinDistance(cleanCode, cleanExisting)).toBeGreaterThan(3);
  });
});
