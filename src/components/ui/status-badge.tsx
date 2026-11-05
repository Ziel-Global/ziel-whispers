import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType =
  // Employee statuses
  | "active"
  | "inactive"
  | "pending"
  // Request & Approval statuses
  | "approved"
  | "rejected"
  | "cancelled"
  // Log statuses
  | "added"
  | "partial_day"
  | "late"
  | "missed"
  | "on_leave"
  | "half_day_leave"
  // Project & Task statuses
  | "on_hold"
  | "completed"
  | "archived"
  | "todo"
  | "in_progress"
  | "done"
  | "blocked"
  | string;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: StatusType | null;
  label?: React.ReactNode;
  dot?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  // Green / Success
  active: "bg-[#DFF6E4] text-[#1B8A46]",
  approved: "bg-[#DFF6E4] text-[#1B8A46]",
  added: "bg-[#DFF6E4] text-[#1B8A46]",
  completed: "bg-[#DFF6E4] text-[#1B8A46]",
  done: "bg-[#DFF6E4] text-[#1B8A46]",
  partial_day: "bg-[#DFF6E4] text-[#1B8A46]",

  // Red / Danger
  rejected: "bg-[#FDECEC] text-[#C23A3A]",
  missed: "bg-[#FDECEC] text-[#C23A3A]",
  blocked: "bg-[#FDECEC] text-[#C23A3A]",
  error: "bg-[#FDECEC] text-[#C23A3A]",

  // Yellow / Amber / Warning
  pending: "bg-[#FDF3E3] text-[#A9720B]",
  late: "bg-[#FDF3E3] text-[#A9720B]",
  on_hold: "bg-[#FDF3E3] text-[#A9720B]",
  watch: "bg-[#FDF3E3] text-[#A9720B]",

  // Blue / Info
  on_leave: "bg-[#EAF3FF] text-[#1C6FC9]",
  half_day_leave: "bg-[#EAF3FF] text-[#1C6FC9]",
  in_progress: "bg-[#EAF3FF] text-[#1C6FC9]",

  // Neutral / Muted
  inactive: "bg-[#F6F5F3] text-[#8B8B92]",
  cancelled: "bg-[#F6F5F3] text-[#8B8B92]",
  archived: "bg-[#F6F5F3] text-[#8B8B92]",
  todo: "bg-[#F6F5F3] text-[#8B8B92]",
};

const STATUS_LABELS: Record<string, string> = {
  added: "Logs Added",
  partial_day: "Partial Day",
  on_leave: "On Leave",
  half_day_leave: "Half Day Leave",
  on_hold: "On Hold",
  in_progress: "In Progress",
};

export function StatusBadge({ status, label, dot = false, className, ...props }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge
        className={cn(
          "bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize",
          className
        )}
        {...props}
      >
        —
      </Badge>
    );
  }

  const normalized = status.toLowerCase().trim().replace(/[-\s]+/g, "_");
  const colorClass = STATUS_COLORS[normalized] || "bg-[#F6F5F3] text-[#8B8B92]";
  const displayLabel = label ?? STATUS_LABELS[normalized] ?? status.replace(/_/g, " ");

  return (
    <Badge
      className={cn(
        "font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize inline-flex items-center gap-1.5",
        colorClass,
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {displayLabel}
    </Badge>
  );
}
