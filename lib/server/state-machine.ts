export type InLibraryStatus = 0 | 1;

export type CheckpointType = "LIBRARY_ENTRY" | "LIBRARY_EXIT" | "LIBRARY_BOTH";
export type ScanMode = "AUTO" | "ENTRY_ONLY" | "EXIT_ONLY";
export type MovementEventType = "LIBRARY_ENTRY" | "LIBRARY_EXIT" | "REJECTED_SCAN" | "ADMIN_CORRECTION";

export interface StateTransitionInput {
  currentInLibrary: InLibraryStatus;
  checkpointType: CheckpointType;
  checkpointIsActive: boolean;
  studentIsActive: boolean;
  scanMode?: ScanMode;
  secondsSinceLastScan?: number;
  duplicateWindowSeconds?: number;
}

export interface StateTransitionResult {
  allowed: boolean;
  targetInLibrary: InLibraryStatus;
  eventType: MovementEventType;
  reasonCode: string;
  message: string;
}

/**
 * Pure state machine transition evaluator.
 * Mirrors the Postgres `scan_student` RPC logic for UI hints, simulations, and unit tests.
 */
export function evaluateScanTransition(input: StateTransitionInput): StateTransitionResult {
  const {
    currentInLibrary,
    checkpointType,
    checkpointIsActive,
    studentIsActive,
    scanMode = "AUTO",
    secondsSinceLastScan,
    duplicateWindowSeconds = 10,
  } = input;

  // 1. Inactive student
  if (!studentIsActive) {
    return {
      allowed: false,
      targetInLibrary: currentInLibrary,
      eventType: "REJECTED_SCAN",
      reasonCode: "STUDENT_INACTIVE",
      message: "Student account is suspended or inactive.",
    };
  }

  // 2. Inactive checkpoint
  if (!checkpointIsActive) {
    return {
      allowed: false,
      targetInLibrary: currentInLibrary,
      eventType: "REJECTED_SCAN",
      reasonCode: "CHECKPOINT_INACTIVE",
      message: "Checkpoint is currently inactive.",
    };
  }

  // 3. Duplicate scan debouncing
  if (secondsSinceLastScan !== undefined && secondsSinceLastScan < duplicateWindowSeconds) {
    return {
      allowed: false,
      targetInLibrary: currentInLibrary,
      eventType: "REJECTED_SCAN",
      reasonCode: "DUPLICATE_SCAN",
      message: `Card scanned again within ${duplicateWindowSeconds} seconds. Please wait.`,
    };
  }

  // 4. Directional State Machine
  if (currentInLibrary === 0) {
    // Attempting entry
    if (scanMode === "EXIT_ONLY" || checkpointType === "LIBRARY_EXIT") {
      return {
        allowed: false,
        targetInLibrary: 0,
        eventType: "REJECTED_SCAN",
        reasonCode: "WRONG_CHECKPOINT_DIRECTION",
        message: "Cannot checkout: Student is already marked outside the library.",
      };
    }

    return {
      allowed: true,
      targetInLibrary: 1,
      eventType: "LIBRARY_ENTRY",
      reasonCode: "ENTRY_SUCCESS",
      message: "Access granted: Student checked into library.",
    };
  } else {
    // Attempting exit (currentInLibrary === 1)
    if (scanMode === "ENTRY_ONLY" || checkpointType === "LIBRARY_ENTRY") {
      return {
        allowed: false,
        targetInLibrary: 1,
        eventType: "REJECTED_SCAN",
        reasonCode: "WRONG_CHECKPOINT_DIRECTION",
        message: "Cannot re-enter: Student is already marked inside the library.",
      };
    }

    return {
      allowed: true,
      targetInLibrary: 0,
      eventType: "LIBRARY_EXIT",
      reasonCode: "EXIT_SUCCESS",
      message: "Checkout complete: Student exited library.",
    };
  }
}
