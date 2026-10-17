import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type WorkSettings = {
  shiftStart: string;
  shiftEnd: string;
  hasCustomShift: boolean;
  annualLeaveEntitlement: number;
  timezone: string;
  workingDays: number;
  graceMinutes: number;
  expectedDailyHours: number;
  onsiteLatitude: number;
  onsiteLongitude: number;
  geofenceRadiusMeters: number;
  geofenceEnabled: boolean;
};

/**
 * Resolves work settings for the current user.
 * All values come from the database (system_settings is seeded with defaults via migration).
 */
export function useWorkSettings() {
  const { user } = useAuth();

  const { data: globalSettings } = useQuery({
    queryKey: ["system-settings-global"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", [
          "default_shift_start",
          "default_shift_end",
          "annual_leave_entitlement",
          "timezone",
          "late_grace_minutes",
          "expected_daily_hours",
          "onsite_latitude",
          "onsite_longitude",
          "onsite_radius_meters",
          "geofence_enabled",
        ]);
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: userShift } = useQuery({
    queryKey: ["user-shift-info", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("shift_start, shift_end, has_custom_shift, working_days")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const hasCustomShift = !!(userShift as any)?.has_custom_shift;
  // Settings come from DB (seeded). Empty strings used only while loading; UI uses formatTime12h which guards.
  const shiftStart = hasCustomShift
    ? (userShift?.shift_start ?? "")
    : (globalSettings?.default_shift_start ?? "");
  const shiftEnd = hasCustomShift
    ? (userShift?.shift_end ?? "")
    : (globalSettings?.default_shift_end ?? "");
  const annualLeaveEntitlement = Number(globalSettings?.annual_leave_entitlement ?? 0);
  const timezone = "Asia/Karachi";
  const graceMinutes = Number(globalSettings?.late_grace_minutes ?? 15);

  const onsiteLatitude = Number(globalSettings?.onsite_latitude ?? 33.712417);
  const onsiteLongitude = Number(globalSettings?.onsite_longitude ?? 73.039444);
  const geofenceRadiusMeters = Number(globalSettings?.onsite_radius_meters ?? 300);
  const geofenceEnabled = globalSettings?.geofence_enabled !== "false";

  const resolved: WorkSettings = {
    shiftStart,
    shiftEnd,
    hasCustomShift,
    annualLeaveEntitlement,
    timezone,
    workingDays: Number((userShift as any)?.working_days || 5),
    graceMinutes,
    expectedDailyHours: Number(globalSettings?.expected_daily_hours ?? 8),
    onsiteLatitude,
    onsiteLongitude,
    geofenceRadiusMeters,
    geofenceEnabled,
  };

  return resolved;
}

/**
 * Format any HH:mm time string to 12-hour display (e.g. "9:00 AM").
 * The single source of truth for time display across the app.
 */
export function formatTime12h(time: string | undefined | null): string {
  if (!time) return "--";
  const parts = time.split(":");
  if (parts.length < 2) return "--";
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return "--";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

/** @deprecated use formatTime12h */
export const formatShiftTime = formatTime12h;

/**
 * Format lateness.
 * Accepts either a single total minutes number, or two args (hours, minutes).
 * Examples: `formatLateness(75)` -> "1h 15m"; `formatLateness(1, 15)` -> "1h 15m".
 */
export function formatLateness(totalOrHours: number, minutes?: number): string {
  let totalMinutes = 0;
  if (typeof minutes === "number") {
    const h = Number(totalOrHours) || 0;
    const m = Number(minutes) || 0;
    totalMinutes = h * 60 + m;
  } else {
    totalMinutes = Number(totalOrHours) || 0;
  }

  if (totalMinutes === 0) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Pakistan Standard Time (PKT) is UTC+5.
 */
function getPKTParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hours: value("hour"),
    minutes: value("minute"),
    seconds: value("second"),
  };
}

function getPKTWeekday(date: Date): number {
  const parts = getPKTParts(date);
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay();
}

/** 
 * Gets "Today" in PKT (Asia/Karachi) regardless of local browser time. 
 * Format: YYYY-MM-DD
 */
export function getPKTDateString(baseDate: Date = new Date()): string {
  const pkt = getPKTParts(baseDate);
  return `${pkt.year}-${pkt.month}-${pkt.day}`;
}

/**
 * Gets "Now" in PKT (Asia/Karachi) as an ISO-like string with offset.
 * Example: 2026-04-21T14:30:00+05:00
 */
export function getPKTISOString(baseDate: Date = new Date()): string {
  const pkt = getPKTParts(baseDate);
  return `${pkt.year}-${pkt.month}-${pkt.day}T${pkt.hours}:${pkt.minutes}:${pkt.seconds}+05:00`;
}

/**
 * Formats a Date or ISO string into a 12-hour PKT time string (e.g. "09:30 AM").
 */
export function formatPKTTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "--";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "--";

  // If the input string has a +05:00 offset, browser Date handles it.
  // If not, we normalize to PKT.
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Checks if the current time is past the shift start time (in PKT).
 * Matches the logic in the database trigger calculate_late_clockin.
 * Pass a `clockInDate` to check a historical clock-in instead of "now".
 */
export function getLatenessInfo(shiftStart: string, graceMinutes: number = 15, workingDays: number = 5, clockInDate?: Date) {
  if (!shiftStart) return { isLate: false, minutesLate: 0 };
  
  const parts = shiftStart.split(":");
  if (parts.length < 2) return { isLate: false, minutesLate: 0 };
  
  const refDate = clockInDate || new Date();
  const pktNow = getPKTParts(refDate);

  // Skip weekends (0=Sun, 6=Sat in JS)
  const day = getPKTWeekday(refDate);
  if (day === 0 || (day === 6 && workingDays === 5)) {
    return { isLate: false, minutesLate: 0 };
  }

  const shiftHour = Number(parts[0]);
  const shiftMinute = Number(parts[1]);
  if (!Number.isFinite(shiftHour) || !Number.isFinite(shiftMinute)) return { isLate: false, minutesLate: 0 };
  const currentMinutes = Number(pktNow.hours) * 60 + Number(pktNow.minutes);
  const diffMins = currentMinutes - (shiftHour * 60 + shiftMinute);
  
  return {
    isLate: diffMins > graceMinutes,
    minutesLate: diffMins,
  };
}

/**
 * Calculates whether an attendance record's clock-in is late.
 * Uses the attendance date (from the `clockIn` timestamp) to build the
 * shift start reference, correctly handling night shifts where clock-in
 * may roll over to the next calendar day.
 */
export function isAttendanceLate(clockIn: string, shiftStart: string, graceMinutes: number = 15, workingDays: number = 5): { isLate: boolean; minutesLate: number } {
  if (!clockIn || !shiftStart) return { isLate: false, minutesLate: 0 };

  const parts = shiftStart.split(":");
  if (parts.length < 2) return { isLate: false, minutesLate: 0 };
  const shiftHour = Number(parts[0]);
  const shiftMinute = Number(parts[1]);
  if (!Number.isFinite(shiftHour) || !Number.isFinite(shiftMinute)) {
    return { isLate: false, minutesLate: 0 };
  }

  const clockInDate = new Date(clockIn);
  if (Number.isNaN(clockInDate.getTime())) return { isLate: false, minutesLate: 0 };
  const pktTime = getPKTParts(clockInDate);

  const day = getPKTWeekday(clockInDate);
  if (day === 0 || (day === 6 && workingDays === 5)) {
    return { isLate: false, minutesLate: 0 };
  }

  const attendanceDate = `${pktTime.year}-${pktTime.month}-${pktTime.day}`;
  const shiftStartPkt = new Date(`${attendanceDate}T${String(shiftHour).padStart(2, "0")}:${String(shiftMinute).padStart(2, "0")}:00+05:00`);

  const diffMs = clockInDate.getTime() - shiftStartPkt.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  return {
    isLate: diffMins > graceMinutes,
    minutesLate: diffMins,
  };
}

/** Grace minutes after shift end before a same-day log submission counts as late. */
export const LOG_SUBMISSION_GRACE_MINUTES = 30;

/**
 * Checks whether a daily log submission was late.
 * If a logDate is provided and is before the submission date, it is always late
 * (the log was due on its log_date and was submitted on a later day).
 * Otherwise, compares the submitted_at time against shift end + grace (in PKT).
 */
export function isLogSubmissionLate(submittedAt: string, shiftEnd: string, logDate?: string): boolean {
  if (!submittedAt || !shiftEnd) return false;

  const submittedDate = new Date(submittedAt);
  if (Number.isNaN(submittedDate.getTime())) return false;
  const pktSubmission = getPKTParts(submittedDate);
  const submissionDateStr = `${pktSubmission.year}-${pktSubmission.month}-${pktSubmission.day}`;

  if (logDate) {
    const subDate = submissionDateStr;
    if (logDate < subDate) return true;
  }

  const parts = shiftEnd.split(":");
  if (parts.length < 2) return false;

  const shiftEndHour = Number(parts[0]);
  const shiftEndMinute = Number(parts[1]);
  if (!Number.isFinite(shiftEndHour) || !Number.isFinite(shiftEndMinute)) return false;
  const submittedMinutes = Number(pktSubmission.hours) * 60 + Number(pktSubmission.minutes);
  const deadlineMinutes = shiftEndHour * 60 + shiftEndMinute + LOG_SUBMISSION_GRACE_MINUTES;
  return submittedMinutes > deadlineMinutes;
}
