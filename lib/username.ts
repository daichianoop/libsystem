import crypto from "crypto";

/**
 * Normalizes a name string: strips diacritics/accents, removes punctuation, collapses spaces.
 */
export function normalizeNamePart(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-zA-Z0-9\s]/g, "") // remove special characters
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

/**
 * Generates standard username based on full name and roll number.
 * Format: `firstname.lastname` + last 3-4 digits of roll number, max 24 chars.
 * E.g.: "Asha Rao", "2024CS4821" -> "asha.rao4821"
 */
export function generateUsername(fullName: string, rollNumber: string): string {
  // Extract roll digits
  const cleanRoll = rollNumber.replace(/\D/g, "");
  const rollSuffix = cleanRoll.length >= 3 ? cleanRoll.slice(-4) : rollNumber.slice(-4).toLowerCase().replace(/[^a-z0-9]/g, "");

  // Clean full name
  const nameParts = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  let baseName = "";
  if (nameParts.length === 1) {
    baseName = nameParts[0];
  } else if (nameParts.length >= 2) {
    baseName = `${nameParts[0]}.${nameParts[nameParts.length - 1]}`;
  } else {
    baseName = "student";
  }

  // Max 24 chars total including rollSuffix
  const maxBaseLen = 24 - rollSuffix.length;
  if (baseName.length > maxBaseLen) {
    baseName = baseName.slice(0, maxBaseLen).replace(/\.$/, "");
  }

  return `${baseName}${rollSuffix}`.toLowerCase();
}

/**
 * Appends a short random alphanumeric suffix on collision (e.g. `asha.rao4821a3`).
 */
export function generateCollisionResolvedUsername(baseUsername: string): string {
  const suffix = crypto.randomBytes(2).toString("hex").slice(0, 3);
  const trimmed = baseUsername.slice(0, 24 - suffix.length);
  return `${trimmed}${suffix}`.toLowerCase();
}
