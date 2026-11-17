import { describe, it, expect } from "vitest";
import { checkAccessWindow, isMinutesInWindow } from "@/lib/time";

describe("Access Window Timings & Enforcement (Asia/Kolkata)", () => {
  const windows = [
    { role: "student", day_of_week: null, open_time: "17:00", close_time: "23:30", is_active: true },
    { role: "scanner", day_of_week: null, open_time: "16:00", close_time: "23:59", is_active: true },
    { role: "admin", day_of_week: null, open_time: "00:00", close_time: "23:59", is_active: true },
  ];

  it("admin always bypasses restrictions at any time", () => {
    const midnight = new Date("2026-11-18T03:00:00+05:30");
    const result = checkAccessWindow("admin", windows, [], midnight);
    expect(result.isAllowed).toBe(true);
  });

  it("permits student within standard window (17:00 - 23:30 IST)", () => {
    const eveningTime = new Date("2026-11-18T19:30:00+05:30");
    const result = checkAccessWindow("student", windows, [], eveningTime);
    expect(result.isAllowed).toBe(true);
  });

  it("blocks student outside access window (e.g. 10:00 AM IST)", () => {
    const morningTime = new Date("2026-11-18T10:00:00+05:30");
    const result = checkAccessWindow("student", windows, [], morningTime);
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("Access permitted only between 17:00 and 23:30 IST");
  });

  it("correctly evaluates overnight windows (e.g. 21:00 to 03:00)", () => {
    const openMin = 21 * 60; // 1260
    const closeMin = 3 * 60; // 180

    // 22:00 (1320 min) -> in window
    expect(isMinutesInWindow(22 * 60, openMin, closeMin)).toBe(true);
    // 02:00 (120 min) -> in window
    expect(isMinutesInWindow(2 * 60, openMin, closeMin)).toBe(true);
    // 12:00 noon (720 min) -> outside window
    expect(isMinutesInWindow(12 * 60, openMin, closeMin)).toBe(false);
  });

  it("enforces date overrides (e.g. closed all day on holiday)", () => {
    const overrides = [
      {
        override_date: "2026-11-18",
        is_closed_all_day: true,
        reason: "Diwali Public Holiday",
      },
    ];

    const eveningTime = new Date("2026-11-18T19:30:00+05:30");
    const result = checkAccessWindow("student", windows, overrides, eveningTime);
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("Diwali Public Holiday");
  });
});
