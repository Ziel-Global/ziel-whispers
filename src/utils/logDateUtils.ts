import { format } from "date-fns";
import { getPKTDateString } from "@/hooks/useWorkSettings";

export const CATEGORIES = [
  "development",
  "meeting",
  "bug_fix",
  "code_review",
  "deployment",
  "documentation",
  "testing",
  "marketing",
  "seo",
  "research",
  "posting",
  "designing",
  "outbound_calls",
  "other",
];

export function getMinDateStr(days: number): string {
  const d = new Date(getPKTDateString());
  d.setDate(d.getDate() - days);
  return format(d, "yyyy-MM-dd");
}

// Previous working day in PKT (the day the missing-log alert checks).
// 5-day: Mon -> Fri, 6-day: Mon -> Sat, otherwise yesterday. Alerts are suppressed on weekends.
export function getPreviousWorkingDay(workingDays: number) {
  const todayPKTStr = getPKTDateString();
  const todayPKT = new Date(todayPKTStr + "T00:00:00");
  const dayOfWeek = todayPKT.getDay();
  const isWeekend = dayOfWeek === 0 || (dayOfWeek === 6 && workingDays === 5);

  let daysToSubtract = 1;
  if (workingDays === 5) {
    if (dayOfWeek === 1) daysToSubtract = 3;
    else if (dayOfWeek === 0) daysToSubtract = 2;
  } else if (workingDays === 6) {
    if (dayOfWeek === 1) daysToSubtract = 2;
  }

  const targetDate = new Date(todayPKT);
  targetDate.setDate(targetDate.getDate() - daysToSubtract);
  return {
    todayPKTStr,
    dayOfWeek,
    isWeekend,
    targetDateStr: getPKTDateString(targetDate),
    targetDayOfWeek: targetDate.getDay(),
  };
}

export function isWithinLogEditWindow(
  dateStr: string,
  todayStr: string,
  windowDays: number,
  workingDays: number
): boolean {
  if (dateStr === todayStr) return true;
  if (windowDays <= 0) return false;

  const checkDate = new Date(dateStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");

  if (checkDate >= today) return false;

  let workingDayCount = 0;
  const cursor = new Date(today);

  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor < checkDate) break;

    const day = cursor.getDay();
    const isWorkingDay = day !== 0 && (day !== 6 || workingDays === 6);
    if (isWorkingDay) {
      workingDayCount++;
      if (workingDayCount > windowDays) return false;
    }
  }

  return true;
}
