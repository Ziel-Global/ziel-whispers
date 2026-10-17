import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  formatHours,
  getLeaveTypeName,
  getLeaveYearOptions,
  getLeaveYearRange,
  getProjectName,
  parseCSVLine,
  toSlug,
  truncateWords,
} from "@/lib/utils";

describe("shared data formatting helpers", () => {
  it("parses CSV fields with quoted commas, escaped quotes, and surrounding spaces", () => {
    expect(parseCSVLine(' 123, "Doe, Jane", "said ""hello""" ')).toEqual([
      "123", "Doe, Jane", 'said "hello"',
    ]);
  });

  it("creates lowercase slugs and removes unsupported punctuation", () => {
    expect(toSlug("Client Portal — Q&A! 2026")).toBe("client-portal--qa-2026");
  });

  it.each([
    { hours: 0.25, expected: "15m" },
    { hours: 1, expected: "1h" },
    { hours: 1.5, expected: "1h 30m" },
    { hours: 2.999, expected: "3h" },
  ])("formats $hours logged hours", ({ hours, expected }) => {
    expect(formatHours(hours)).toBe(expected);
  });

  it("uses project name when available and a miscellaneous fallback otherwise", () => {
    expect(getProjectName({ projects: { name: "Payments" } })).toBe("Payments");
    expect(getProjectName({ projects: null })).toBe("Miscellaneous");
  });

  it("resolves leave type from hourly details, reason, relation, then default", () => {
    expect(getLeaveTypeName({ hours: 2 })).toBe("Hourly Leave — 2 hours");
    expect(getLeaveTypeName({ reason: "Medical - appointment", leave_types: { name: "Annual" } })).toBe("Medical");
    expect(getLeaveTypeName({ leave_types: { name: "Annual" } })).toBe("Annual");
    expect(getLeaveTypeName({})).toBe("Annual");
    expect(getLeaveTypeName(null)).toBe("");
  });

  it("builds June-to-May leave year ranges and three selectable years", () => {
    expect(getLeaveYearRange(2025)).toEqual({
      startYear: 2025,
      start: "2025-06-01",
      end: "2026-05-31",
      label: "June 2025 — May 2026",
    });
    expect(getLeaveYearOptions()).toHaveLength(3);
  });

  it("truncates long descriptions while preserving short ones", () => {
    expect(truncateWords("one two", 2)).toBe("one two");
    expect(truncateWords("one two three four", 2)).toBe("one two...");
    expect(truncateWords(null, 2)).toBeNull();
  });
});
