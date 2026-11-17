import { toZonedTime, format } from "date-fns-tz";

export const APP_TIMEZONE = "Asia/Kolkata";

export interface TimeWindow {
  role: string;
  day_of_week?: number | null;
  open_time: string; // "HH:mm" or "HH:mm:ss"
  close_time: string;
  is_active: boolean;
}

export interface TimeOverride {
  override_date: string; // "YYYY-MM-DD"
  role?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  is_closed_all_day: boolean;
  reason: string;
}

export interface WindowCheckResult {
  isAllowed: boolean;
  reason?: string;
  openTime?: string;
  closeTime?: string;
  nextOpenTime?: string;
  currentIstTime: string;
}

/**
 * Returns the current date/time converted to Asia/Kolkata timezone.
 */
export function getIstDate(date: Date = new Date()): Date {
  return toZonedTime(date, APP_TIMEZONE);
}

/**
 * Parses "HH:mm" or "HH:mm:ss" into minutes from midnight (0 - 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Determines whether the given role is within its configured access window.
 * Supports standard windows, overnight windows (close < open), day of week, and overrides.
 * Admin role ALWAYS bypasses restrictions to prevent lockout.
 */
export function checkAccessWindow(
  role: string,
  windows: TimeWindow[],
  overrides: TimeOverride[] = [],
  currentTime: Date = new Date()
): WindowCheckResult {
  const istDate = getIstDate(currentTime);
  const currentFormatted = format(istDate, "HH:mm", { timeZone: APP_TIMEZONE });
  const currentDateStr = format(istDate, "yyyy-MM-dd", { timeZone: APP_TIMEZONE });
  const currentDayOfWeek = istDate.getDay(); // 0 = Sunday, 6 = Saturday
  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();

  // Admin always has unrestricted access
  if (role === "admin") {
    return {
      isAllowed: true,
      openTime: "00:00",
      closeTime: "23:59",
      currentIstTime: currentFormatted,
    };
  }

  // 1. Check for specific date override first
  const activeOverride = overrides.find(
    (o) =>
      o.override_date === currentDateStr &&
      (!o.role || o.role === role)
  );

  if (activeOverride) {
    if (activeOverride.is_closed_all_day) {
      return {
        isAllowed: false,
        reason: `Campus/Library closed: ${activeOverride.reason}`,
        currentIstTime: currentFormatted,
      };
    }

    if (activeOverride.open_time && activeOverride.close_time) {
      const openMin = timeStringToMinutes(activeOverride.open_time);
      const closeMin = timeStringToMinutes(activeOverride.close_time);
      const isAllowed = isMinutesInWindow(currentMinutes, openMin, closeMin);
      return {
        isAllowed,
        openTime: activeOverride.open_time,
        closeTime: activeOverride.close_time,
        reason: isAllowed ? undefined : `Outside override window (${activeOverride.reason})`,
        currentIstTime: currentFormatted,
      };
    }
  }

  // 2. Find matching window (prefer specific day of week, fallback to NULL/all)
  const roleWindows = windows.filter((w) => w.role === role && w.is_active);
  const specificDayWindow = roleWindows.find((w) => w.day_of_week === currentDayOfWeek);
  const defaultWindow = roleWindows.find((w) => w.day_of_week === null || w.day_of_week === undefined);
  const activeWindow = specificDayWindow || defaultWindow;

  if (!activeWindow) {
    // If no window is defined, default to closed for safety
    return {
      isAllowed: false,
      reason: "No active access window configured for this role",
      currentIstTime: currentFormatted,
    };
  }

  const openMin = timeStringToMinutes(activeWindow.open_time);
  const closeMin = timeStringToMinutes(activeWindow.close_time);
  const isAllowed = isMinutesInWindow(currentMinutes, openMin, closeMin);

  return {
    isAllowed,
    openTime: activeWindow.open_time,
    closeTime: activeWindow.close_time,
    reason: isAllowed ? undefined : `Access permitted only between ${activeWindow.open_time} and ${activeWindow.close_time} IST`,
    currentIstTime: currentFormatted,
  };
}

/**
 * Checks if current minute of day falls within [openMin, closeMin], supporting overnight windows.
 */
export function isMinutesInWindow(current: number, open: number, close: number): boolean {
  if (open <= close) {
    // Normal same-day window (e.g. 17:00 to 23:30)
    return current >= open && current <= close;
  } else {
    // Overnight window (e.g. 20:00 to 04:00)
    return current >= open || current <= close;
  }
}
