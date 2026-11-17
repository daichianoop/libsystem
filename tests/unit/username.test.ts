import { describe, it, expect } from "vitest";
import { generateUsername, generateCollisionResolvedUsername, normalizeNamePart } from "@/lib/username";

describe("Username Generation", () => {
  it("generates correct format from standard first and last name with roll number", () => {
    const username = generateUsername("Asha Rao", "2024CS4821");
    expect(username).toBe("asha.rao4821");
  });

  it("handles single-word names correctly", () => {
    const username = generateUsername("Kabir", "2025ME1045");
    expect(username).toBe("kabir1045");
  });

  it("handles names with multiple middle names by using first and last name", () => {
    const username = generateUsername("Vikramaditya Chandra Bose", "2023EC8899");
    expect(username).toBe("vikramaditya.bose8899");
  });

  it("strips diacritics, accents and special characters", () => {
    const username = generateUsername("Renée D'Souza", "2024IT3322");
    expect(username).toBe("renee.dsouza3322");
  });

  it("enforces maximum length of 24 characters", () => {
    const veryLongName = "Bartholomew Montgomery Alexander-Fitzgerald";
    const username = generateUsername(veryLongName, "2026BT9999");
    expect(username.length).toBeLessThanOrEqual(24);
    expect(username).toMatch(/^[a-z0-9.]+$/);
  });

  it("resolves collisions by appending a short random alphanumeric suffix", () => {
    const original = "asha.rao4821";
    const resolved = generateCollisionResolvedUsername(original);
    expect(resolved.startsWith("asha.rao4821") || resolved.length <= 24).toBe(true);
    expect(resolved).not.toBe(original);
    expect(resolved.length).toBeLessThanOrEqual(24);
  });
});
