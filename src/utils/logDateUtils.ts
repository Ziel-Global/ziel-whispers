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
