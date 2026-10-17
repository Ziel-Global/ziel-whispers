import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  formatLateness,
  formatPKTTime,
  formatTime12h,
  getPKTDateString,
  getPKTISOString,
  getLatenessInfo,
  isAttendanceLate,
  isLogSubmissionLate,
} from "@/hooks/useWorkSettings";

describe("attendance and shift rules", () => {
  it.each([
    { time: "00:05", expected: "12:05 AM" },
    { time: "09:07", expected: "9:07 AM" },
    { time: "12:00", expected: "12:00 PM" },
    { time: "23:59", expected: "11:59 PM" },
    { time: null, expected: "--" },
    { time: "invalid", expected: "--" },
  ])("formats shift time $time", ({ time, expected }) => {
    expect(formatTime12h(time)).toBe(expected);
  });

  it("formats lateness durations without losing minute remainders", () => {
    expect(formatLateness(0)).toBe("0m");
    expect(formatLateness(15)).toBe("15m");
    expect(formatLateness(60)).toBe("1h");
    expect(formatLateness(75)).toBe("1h 15m");
    expect(formatLateness(1, 15)).toBe("1h 15m");
  });

  it("formats timestamps in Pakistan Standard Time", () => {
    expect(formatPKTTime("2026-10-19T04:30:00Z")).toMatch(/9:30\sAM/i);
  });

  it("resolves PKT dates and timestamps across a UTC date boundary", () => {
    const justAfterMidnightPKT = new Date("2026-10-18T20:00:00Z");
    expect(getPKTDateString(justAfterMidnightPKT)).toBe("2026-10-19");
    expect(getPKTISOString(justAfterMidnightPKT)).toBe("2026-10-19T01:00:00+05:00");
  });

  it("applies grace minutes to historical clock-ins and skips non-working days", () => {
    expect(isAttendanceLate("2026-10-19T09:15:00+05:00", "09:00", 15, 5)).toEqual({ isLate: false, minutesLate: 15 });
    expect(isAttendanceLate("2026-10-19T09:16:00+05:00", "09:00", 15, 5)).toEqual({ isLate: true, minutesLate: 16 });
    expect(isAttendanceLate("2026-10-18T10:00:00+05:00", "09:00", 0, 5)).toEqual({ isLate: false, minutesLate: 0 });
  });

  it("evaluates current lateness with an explicit reference time", () => {
    expect(getLatenessInfo("09:00", 15, 5, new Date("2026-10-19T09:15:00+05:00"))).toEqual({ isLate: false, minutesLate: 15 });
    expect(getLatenessInfo("09:00", 15, 5, new Date("2026-10-19T09:16:00+05:00"))).toEqual({ isLate: true, minutesLate: 16 });
  });

  it("marks log submissions late after the grace period or on a later date", () => {
    expect(isLogSubmissionLate("2026-10-19T17:30:00+05:00", "17:00", "2026-10-19")).toBe(false);
    expect(isLogSubmissionLate("2026-10-19T17:31:00+05:00", "17:00", "2026-10-19")).toBe(true);
    expect(isLogSubmissionLate("2026-10-20T09:00:00+05:00", "17:00", "2026-10-19")).toBe(true);
  });
});
