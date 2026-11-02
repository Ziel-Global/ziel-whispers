import { describe, it, expect } from "vitest";
import {
  resolveDateRange,
  filtersToSearchParams,
  searchParamsToFilters,
  countActiveFilters,
  DEFAULT_ANALYTICS_FILTERS,
  AnalyticsFilterState,
} from "../analytics-filter-utils";

describe("Analytics Filter Utilities", () => {
  const refDate = new Date("2026-10-28T12:00:00Z");

  it("resolves 'today' preset correctly", () => {
    const res = resolveDateRange("today", undefined, undefined, "none", refDate);
    expect(res.startDate).toBe("2026-10-28");
    expect(res.endDate).toBe("2026-10-28");
  });

  it("resolves 'yesterday' preset correctly", () => {
    const res = resolveDateRange("yesterday", undefined, undefined, "none", refDate);
    expect(res.startDate).toBe("2026-10-27");
    expect(res.endDate).toBe("2026-10-27");
    expect(res.label).toBe("Yesterday");
  });

  it("resolves 'this_week' preset correctly (Monday to Sunday)", () => {
    const res = resolveDateRange("this_week", undefined, undefined, "none", refDate);
    expect(res.label).toBe("This Week");
    expect(res.startDate.length).toBe(10);
    expect(res.endDate.length).toBe(10);
  });

  it("resolves 'mtd' preset with previous period comparison", () => {
    const res = resolveDateRange("mtd", undefined, undefined, "previous_period", refDate);
    expect(res.startDate).toBe("2026-10-01");
    expect(res.endDate).toBe("2026-10-28");
    expect(res.comparisonStartDate).toBeDefined();
    expect(res.comparisonEndDate).toBeDefined();
  });

  it("resolves 'last_month' preset correctly", () => {
    const res = resolveDateRange("last_month", undefined, undefined, "none", refDate);
    expect(res.startDate).toBe("2026-09-01");
    expect(res.endDate).toBe("2026-09-30");
    expect(res.label).toBe("Last Month");
  });

  it("resolves 'custom' preset correctly", () => {
    const res = resolveDateRange("custom", "2026-06-01", "2026-06-15", "none", refDate);
    expect(res.startDate).toBe("2026-06-01");
    expect(res.endDate).toBe("2026-06-15");
  });

  it("serializes and deserializes filters through URLSearchParams symmetrically", () => {
    const initial: AnalyticsFilterState = {
      preset: "last_30_days",
      comparison: "previous_period",
      granularity: "week",
      clientId: "client-123",
      projectId: "proj-456",
      sprintId: "sprint-789",
      department: "Engineering",
      role: "developer",
      userId: "user-1",
      workMode: "remote",
      billableOnly: true,
    };

    const params = filtersToSearchParams(initial);
    expect(params.get("preset")).toBe("last_30_days");
    expect(params.get("client")).toBe("client-123");
    expect(params.get("project")).toBe("proj-456");
    expect(params.get("mode")).toBe("remote");
    expect(params.get("billable")).toBe("true");

    const parsed = searchParamsToFilters(params);
    expect(parsed.preset).toBe(initial.preset);
    expect(parsed.clientId).toBe(initial.clientId);
    expect(parsed.projectId).toBe(initial.projectId);
    expect(parsed.workMode).toBe(initial.workMode);
    expect(parsed.billableOnly).toBe(true);
  });

  it("counts active non-date filters accurately", () => {
    expect(countActiveFilters(DEFAULT_ANALYTICS_FILTERS)).toBe(0);

    const withFilters: AnalyticsFilterState = {
      ...DEFAULT_ANALYTICS_FILTERS,
      clientId: "client-1",
      department: "Engineering",
      workMode: "onsite",
    };
    expect(countActiveFilters(withFilters)).toBe(3);
  });
});
