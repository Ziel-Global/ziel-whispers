import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { isWithinLogEditWindow } from "@/utils/logDateUtils";

describe("daily log edit window", () => {
  const today = "2026-10-19"; // Monday; keeps weekday boundary cases deterministic.

  it("always permits today's logs, including when the edit window is disabled", () => {
    expect(isWithinLogEditWindow(today, today, 0, 5)).toBe(true);
  });

  it("rejects past dates when the configured window is zero or negative", () => {
    expect(isWithinLogEditWindow("2026-10-16", today, 0, 5)).toBe(false);
    expect(isWithinLogEditWindow("2026-10-16", today, -1, 5)).toBe(false);
  });

  it("rejects future dates", () => {
    expect(isWithinLogEditWindow("2026-10-20", today, 10, 5)).toBe(false);
  });

  it("counts weekdays, excluding Saturday and Sunday for a five-day schedule", () => {
    expect(isWithinLogEditWindow("2026-10-16", today, 1, 5)).toBe(true); // Friday
    expect(isWithinLogEditWindow("2026-10-15", today, 1, 5)).toBe(false); // Thursday
  });

  it("counts Saturday as a working day for a six-day schedule", () => {
    expect(isWithinLogEditWindow("2026-10-17", today, 1, 6)).toBe(true); // Saturday
    expect(isWithinLogEditWindow("2026-10-16", today, 1, 6)).toBe(false); // Friday, with Saturday also counted
  });

  it("includes the candidate date in the working-day window", () => {
    expect(isWithinLogEditWindow("2026-10-16", today, 1, 5)).toBe(true);
  });

  it("allows a past non-working date when the intervening working-day count is within the window", () => {
    // This helper checks the edit window only; the form separately validates whether
    // a log may be submitted for a weekend based on the employee's schedule.
    expect(isWithinLogEditWindow("2026-10-18", today, 1, 5)).toBe(true); // Sunday
  });
});
