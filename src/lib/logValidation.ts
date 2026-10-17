import { z } from "zod";
import { MISC_PROJECT_ID } from "@/lib/utils";
import { isWithinLogEditWindow } from "@/utils/logDateUtils";

export type DailyLogValidationOptions = {
  overtimeEnabled: boolean;
  workingDays: number;
  today: string;
  editWindowDays: number;
  submittedHoursByDate: Record<string, number>;
};

export function createDailyLogSchema({
  overtimeEnabled,
  workingDays,
  today,
  editWindowDays,
  submittedHoursByDate,
}: DailyLogValidationOptions) {
  return z.object({
    project_id: z.string().min(1, "Please select a project"),
    category: z.string().min(1, "Category is required"),
    hours: z.number().min(0.25, "Min 0.25 hours").max(24, "Max 24 hours"),
    description: z.string().min(20, "Min 20 characters"),
    log_date: z.string().min(1, "Date is required")
      .refine((value) => {
        const day = new Date(`${value}T00:00:00`).getDay();
        if (overtimeEnabled) return true;
        if (day === 0) return false;
        if (day === 6 && workingDays === 5) return false;
        return true;
      }, "Cannot submit logs for this day")
      .refine((value) => isWithinLogEditWindow(value, today, editWindowDays, workingDays),
        "You are not allowed to edit logs for this date")
      .refine((value) => overtimeEnabled || (submittedHoursByDate[value] || 0) < 24,
        "This day already has the maximum hours logged"),
    task_id: z.string().nullable().optional(),
  }).refine((data) => data.project_id === MISC_PROJECT_ID || !!data.task_id, {
    message: "Please select a task (or 'Other')",
    path: ["task_id"],
  });
}
