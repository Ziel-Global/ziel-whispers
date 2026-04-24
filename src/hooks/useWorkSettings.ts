import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type WorkSettings = {
  shiftStart: string;
  shiftEnd: string;
  hasCustomShift: boolean;
  annualLeaveEntitlement: number;
  timezone: string;
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
        .select("shift_start, shift_end, has_custom_shift")
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

  const resolved: WorkSettings = {
    shiftStart,
    shiftEnd,
    hasCustomShift,
    annualLeaveEntitlement,
    timezone,
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
const PKT_OFFSET_HOURS = 5;

/** 
 * Gets "Today" in PKT (Asia/Karachi) regardless of local browser time. 
 * Format: YYYY-MM-DD
 */
export function getPKTDateString(baseDate: Date = new Date()): string {
  const utc = baseDate.getTime() + (baseDate.getTimezoneOffset() * 60000);
  const pktDate = new Date(utc + (3600000 * PKT_OFFSET_HOURS));
  const year = pktDate.getFullYear();
  const month = String(pktDate.getMonth() + 1).padStart(2, "0");
  const day = String(pktDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Gets "Now" in PKT (Asia/Karachi) as an ISO-like string with offset.
 * Example: 2026-04-21T14:30:00+05:00
 */
export function getPKTISOString(baseDate: Date = new Date()): string {
  const utc = baseDate.getTime() + (baseDate.getTimezoneOffset() * 60000);
  const pktDate = new Date(utc + (3600000 * PKT_OFFSET_HOURS));
  
  const year = pktDate.getFullYear();
  const month = String(pktDate.getMonth() + 1).padStart(2, "0");
  const day = String(pktDate.getDate()).padStart(2, "0");
  const hours = String(pktDate.getHours()).padStart(2, "0");
  const minutes = String(pktDate.getMinutes()).padStart(2, "0");
  const seconds = String(pktDate.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:00`;
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
 */
export function getLatenessInfo(shiftStart: string, graceMinutes: number = 15) {
  if (!shiftStart) return { isLate: false, minutesLate: 0 };
  
  const parts = shiftStart.split(":");
  if (parts.length < 2) return { isLate: false, minutesLate: 0 };
  
  const now = new Date();
  // Calculate day of week (1=Mon, ..., 7=Sun)
  // getTimezoneOffset is in minutes. PKT is UTC+5, so offset 300 mins.
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pktNow = new Date(utc + (3600000 * 5));
  
  // Skip weekends (0=Sun, 6=Sat in JS)
  const day = pktNow.getDay();
  if (day === 0 || day === 6) {
    return { isLate: false, minutesLate: 0 };
  }
  
  const shiftStartTime = new Date(pktNow);
  shiftStartTime.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  
  const diffMs = pktNow.getTime() - shiftStartTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  return {
    isLate: diffMins > graceMinutes,
    minutesLate: diffMins,
  };
}
