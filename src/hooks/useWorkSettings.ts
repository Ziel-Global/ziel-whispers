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
  const timezone = globalSettings?.timezone ?? "";

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

/** Format lateness from hours_late and minutes_late stored on attendance record */
export function formatLateness(hoursLate: number, minutesLate: number): string {
  const h = hoursLate || 0;
  const m = minutesLate || 0;
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
