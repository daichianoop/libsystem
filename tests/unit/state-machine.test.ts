import { describe, it, expect } from "vitest";
import { evaluateScanTransition } from "@/lib/server/state-machine";

describe("State Machine Transition Rules", () => {
  it("transitions 0 -> 1 on valid entry at bidirectional checkpoint", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 0,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.targetInLibrary).toBe(1);
    expect(result.eventType).toBe("LIBRARY_ENTRY");
    expect(result.reasonCode).toBe("ENTRY_SUCCESS");
  });

  it("transitions 1 -> 0 on valid exit at bidirectional checkpoint", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 1,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.targetInLibrary).toBe(0);
    expect(result.eventType).toBe("LIBRARY_EXIT");
    expect(result.reasonCode).toBe("EXIT_SUCCESS");
  });

  it("rejects entry at an EXIT_ONLY checkpoint", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 0,
      checkpointType: "LIBRARY_EXIT",
      checkpointIsActive: true,
      studentIsActive: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.targetInLibrary).toBe(0);
    expect(result.eventType).toBe("REJECTED_SCAN");
    expect(result.reasonCode).toBe("WRONG_CHECKPOINT_DIRECTION");
  });

  it("rejects exit at an ENTRY_ONLY checkpoint", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 1,
      checkpointType: "LIBRARY_ENTRY",
      checkpointIsActive: true,
      studentIsActive: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.targetInLibrary).toBe(1);
    expect(result.eventType).toBe("REJECTED_SCAN");
    expect(result.reasonCode).toBe("WRONG_CHECKPOINT_DIRECTION");
  });

  it("enforces duplicate-scan debouncing within 10 seconds", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 0,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: true,
      secondsSinceLastScan: 4, // 4 seconds ago
      duplicateWindowSeconds: 10,
    });

    expect(result.allowed).toBe(false);
    expect(result.eventType).toBe("REJECTED_SCAN");
    expect(result.reasonCode).toBe("DUPLICATE_SCAN");
  });

  it("rejects scan if student account is inactive/suspended", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 0,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: true,
      studentIsActive: false, // inactive
    });

    expect(result.allowed).toBe(false);
    expect(result.eventType).toBe("REJECTED_SCAN");
    expect(result.reasonCode).toBe("STUDENT_INACTIVE");
  });

  it("rejects scan if checkpoint is inactive", () => {
    const result = evaluateScanTransition({
      currentInLibrary: 0,
      checkpointType: "LIBRARY_BOTH",
      checkpointIsActive: false, // inactive
      studentIsActive: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.eventType).toBe("REJECTED_SCAN");
    expect(result.reasonCode).toBe("CHECKPOINT_INACTIVE");
  });
});
