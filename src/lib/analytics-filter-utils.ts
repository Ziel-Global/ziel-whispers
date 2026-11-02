import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subYears,
  differenceInCalendarDays,
  parseISO,
} from "date-fns";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "mtd"
  | "last_month"
  | "qtd"
  | "last_quarter"
  | "ytd"
  | "last_30_days"
  | "last_90_days"
  | "custom";

export type ComparisonType = "none" | "previous_period" | "same_period_last_year";
export type Granularity = "day" | "week" | "month" | "quarter";

export interface ResolvedDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  comparisonStartDate?: string;
  comparisonEndDate?: string;
  label: string;
}

export interface AnalyticsFilterState {
  preset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  comparison: ComparisonType;
  granularity: Granularity;
  clientId: string | null;
  projectId: string | null;
  sprintId: string | null;
  department: string | null;
  role: string | null;
  userId: string | null;
  workMode: "all" | "onsite" | "remote";
  billableOnly: boolean;
}

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilterState = {
  preset: "mtd",
  comparison: "previous_period",
  granularity: "month",
  clientId: null,
  projectId: null,
  sprintId: null,
  department: null,
  role: null,
  userId: null,
  workMode: "all",
  billableOnly: false,
};

/**
 * Resolves a date preset to exact start and end date strings (YYYY-MM-DD),
 * and optionally calculates the comparison window dates.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  comparison: ComparisonType = "none",
  referenceDate: Date = new Date()
): ResolvedDateRange {
  let start: Date;
  let end: Date;
  let label = "";

  switch (preset) {
    case "today":
      start = referenceDate;
      end = referenceDate;
      label = "Today";
      break;
    case "yesterday": {
      const y = subDays(referenceDate, 1);
      start = y;
      end = y;
      label = "Yesterday";
      break;
    }
    case "this_week":
      start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      label = "This Week";
      break;
    case "last_week": {
      const prevWeekDay = subDays(referenceDate, 7);
      start = startOfWeek(prevWeekDay, { weekStartsOn: 1 });
      end = endOfWeek(prevWeekDay, { weekStartsOn: 1 });
      label = "Last Week";
      break;
    }
    case "mtd":
      start = startOfMonth(referenceDate);
      end = referenceDate;
      label = "Month to Date";
      break;
    case "last_month": {
      const prevMonth = subMonths(referenceDate, 1);
      start = startOfMonth(prevMonth);
      end = endOfMonth(prevMonth);
      label = "Last Month";
      break;
    }
    case "qtd":
      start = startOfQuarter(referenceDate);
      end = referenceDate;
      label = "Quarter to Date";
      break;
    case "last_quarter": {
      const prevQ = subQuarters(referenceDate, 1);
      start = startOfQuarter(prevQ);
      end = endOfQuarter(prevQ);
      label = "Last Quarter";
      break;
    }
    case "ytd":
      start = startOfYear(referenceDate);
      end = referenceDate;
      label = "Year to Date";
      break;
    case "last_30_days":
      start = subDays(referenceDate, 29);
      end = referenceDate;
      label = "Last 30 Days";
      break;
    case "last_90_days":
      start = subDays(referenceDate, 89);
      end = referenceDate;
      label = "Last 90 Days";
      break;
    case "custom":
    default:
      start = customStart ? parseISO(customStart) : startOfMonth(referenceDate);
      end = customEnd ? parseISO(customEnd) : referenceDate;
      label = `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
      break;
  }

  const startDateStr = format(start, "yyyy-MM-dd");
  const endDateStr = format(end, "yyyy-MM-dd");

  let compStartStr: string | undefined;
  let compEndStr: string | undefined;

  if (comparison === "previous_period") {
    const daysDiff = differenceInCalendarDays(end, start) + 1;
    const compEnd = subDays(start, 1);
    const compStart = subDays(compEnd, daysDiff - 1);
    compStartStr = format(compStart, "yyyy-MM-dd");
    compEndStr = format(compEnd, "yyyy-MM-dd");
  } else if (comparison === "same_period_last_year") {
    const compStart = subYears(start, 1);
    const compEnd = subYears(end, 1);
    compStartStr = format(compStart, "yyyy-MM-dd");
    compEndStr = format(compEnd, "yyyy-MM-dd");
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    comparisonStartDate: compStartStr,
    comparisonEndDate: compEndStr,
    label,
  };
}

/**
 * Serializes filter state into a URLSearchParams object.
 */
export function filtersToSearchParams(filters: AnalyticsFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.preset !== DEFAULT_ANALYTICS_FILTERS.preset) {
    params.set("preset", filters.preset);
  }
  if (filters.preset === "custom") {
    if (filters.customStartDate) params.set("from", filters.customStartDate);
    if (filters.customEndDate) params.set("to", filters.customEndDate);
  }
  if (filters.comparison !== DEFAULT_ANALYTICS_FILTERS.comparison) {
    params.set("compare", filters.comparison);
  }
  if (filters.granularity !== DEFAULT_ANALYTICS_FILTERS.granularity) {
    params.set("granularity", filters.granularity);
  }
  if (filters.clientId) params.set("client", filters.clientId);
  if (filters.projectId) params.set("project", filters.projectId);
  if (filters.sprintId) params.set("sprint", filters.sprintId);
  if (filters.department) params.set("dept", filters.department);
  if (filters.role) params.set("role", filters.role);
  if (filters.userId) params.set("user", filters.userId);
  if (filters.workMode !== "all") params.set("mode", filters.workMode);
  if (filters.billableOnly) params.set("billable", "true");

  return params;
}

/**
 * Deserializes URLSearchParams into an AnalyticsFilterState.
 */
export function searchParamsToFilters(params: URLSearchParams): AnalyticsFilterState {
  const preset = (params.get("preset") as DateRangePreset) || DEFAULT_ANALYTICS_FILTERS.preset;
  const customStartDate = params.get("from") || undefined;
  const customEndDate = params.get("to") || undefined;
  const comparison = (params.get("compare") as ComparisonType) || DEFAULT_ANALYTICS_FILTERS.comparison;
  const granularity = (params.get("granularity") as Granularity) || DEFAULT_ANALYTICS_FILTERS.granularity;

  return {
    preset,
    customStartDate,
    customEndDate,
    comparison,
    granularity,
    clientId: params.get("client") || null,
    projectId: params.get("project") || null,
    sprintId: params.get("sprint") || null,
    department: params.get("dept") || null,
    role: params.get("role") || null,
    userId: params.get("user") || null,
    workMode: (params.get("mode") as "all" | "onsite" | "remote") || "all",
    billableOnly: params.get("billable") === "true",
  };
}

/**
 * Counts how many non-date filters are actively applied.
 */
export function countActiveFilters(filters: AnalyticsFilterState): number {
  let count = 0;
  if (filters.clientId) count++;
  if (filters.projectId) count++;
  if (filters.sprintId) count++;
  if (filters.department) count++;
  if (filters.role) count++;
  if (filters.userId) count++;
  if (filters.workMode !== "all") count++;
  if (filters.billableOnly) count++;
  return count;
}
