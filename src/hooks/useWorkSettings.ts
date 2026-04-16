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
 * Resolves work settings for the current user:
 * - If employee has has_custom_shift=true, uses their personal shift times
 * - Otherwise, reads global defaults from system_settings
 * - Always reads annual leave entitlement from system_settings
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
  const shiftStart = hasCustomShift
    ? userShift?.shift_start || "09:00"
    : globalSettings?.default_shift_start || "09:00";
  const shiftEnd = hasCustomShift
    ? userShift?.shift_end || "18:00"
    : globalSettings?.default_shift_end || "18:00";
  const annualLeaveEntitlement = Number(globalSettings?.annual_leave_entitlement) || 12;
  const timezone = globalSettings?.timezone || "Asia/Karachi";

  const resolved: WorkSettings = {
    shiftStart,
    shiftEnd,
    hasCustomShift,
    annualLeaveEntitlement,
    timezone,
  };

  return resolved;
}

/** Format HH:mm time string to 12-hour display */
export function formatShiftTime(time: string | undefined | null): string {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

/** Format lateness from hours_late and minutes_late stored on attendance record */
export function formatLateness(hoursLate: number, minutesLate: number): string {
  const h = hoursLate || 0;
  const m = minutesLate || 0;
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
