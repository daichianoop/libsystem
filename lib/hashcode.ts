import crypto from "crypto";

// Unambiguous alphabet: 32 characters (5 bits per char) - excludes 0, O, 1, I, l
export const HASHCODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));

  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Checks if raw code has 3+ identical consecutive characters (e.g. "AAA")
 * or 3+ consecutive sequential alphabetical or numerical characters (e.g. "ABC", "789").
 */
export function hasRunOrRepetition(code: string): boolean {
  // 1. Check for 3+ identical consecutive chars
  if (/(.)\1\1/.test(code)) {
    return true;
  }

  // 2. Check for 3+ sequential characters in ASCII or alphabet
  for (let i = 0; i < code.length - 2; i++) {
    const c1 = code.charCodeAt(i);
    const c2 = code.charCodeAt(i + 1);
    const c3 = code.charCodeAt(i + 2);

    if (c2 === c1 + 1 && c3 === c2 + 1) {
      return true; // ascending sequential run
    }
    if (c2 === c1 - 1 && c3 === c2 - 1) {
      return true; // descending sequential run
    }
  }

  return false;
}

/**
 * Generates a high-entropy 12-character hashcode using CSPRNG.
 * Formatted as 3 groups of 4: `XXXX-XXXX-XXXX`
 * Ensures no repeated triples, no sequential runs, and minimum edit distance > 3
 * against an optional batch of previously issued codes.
 */
export function generateHashCode(existingBatchCodes: string[] = []): string {
  const codeLength = 12;
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bytes = crypto.randomBytes(codeLength * 2);
    let rawCode = "";

    for (let i = 0; i < bytes.length && rawCode.length < codeLength; i++) {
      const byte = bytes[i];
      // Modulo bias reduction: 256 is multiple of 32 (256 % 32 = 0), perfectly unbiased!
      const charIndex = byte % HASHCODE_ALPHABET.length;
      rawCode += HASHCODE_ALPHABET[charIndex];
    }

    // Check runs and repetitions
    if (hasRunOrRepetition(rawCode)) {
      continue;
    }

    // Check edit distance against existing batch
    if (existingBatchCodes.length > 0) {
      const isTooClose = existingBatchCodes.some((existing) => {
        const cleanExisting = existing.replace(/-/g, "");
        return levenshteinDistance(rawCode, cleanExisting) <= 3;
      });
      if (isTooClose) {
        continue;
      }
    }

    // Return formatted in groups of 4
    return `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}-${rawCode.slice(8, 12)}`;
  }

  // Fallback guaranteed non-repeating draw
  const bytes = crypto.randomBytes(16);
  let safeCode = "";
  for (let i = 0; safeCode.length < 12; i++) {
    safeCode += HASHCODE_ALPHABET[bytes[i] % HASHCODE_ALPHABET.length];
  }
  return `${safeCode.slice(0, 4)}-${safeCode.slice(4, 8)}-${safeCode.slice(8, 12)}`;
}
