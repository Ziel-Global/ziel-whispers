export type TaskStateBucket = "Unlinked" | "Development" | "Complete" | "Returned";

export const TASK_STATE_BUCKETS: TaskStateBucket[] = [
  "Unlinked",
  "Development",
  "Complete",
  "Returned",
];

/** Donut / legend colors */
export const TASK_STATE_COLORS: Record<TaskStateBucket, string> = {
  Unlinked: "#B8BBC2",
  Development: "#E4AD32",
  Complete: "#1FAA59",
  Returned: "#E5687A",
};

/** Kanban column dot colors (HTML mock) */
export const TASK_STATE_KANBAN_DOT: Record<TaskStateBucket, string> = {
  Unlinked: "#B0B0B6",
  Development: "#E6B437",
  Complete: "#1FAA59",
  Returned: "#E5687A",
};

export const PRIORITY_PILL_CLASS: Record<string, string> = {
  low: "bg-[#DFF6E4] text-[#1B8A46]",
  medium: "bg-[#FFF1B8] text-[#A9720B]",
  high: "bg-[#FDE1E1] text-[#C23A3A]",
};

export const STATUS_PILL_CLASS: Record<TaskStateBucket, string> = {
  Unlinked: "bg-[#F0F0F2] text-[#55555B]",
  Development: "bg-[#FFF1B8] text-[#9E7200]",
  Complete: "bg-[#DFF6E4] text-[#1B8A46]",
  Returned: "bg-[#FDE1E1] text-[#C23A3A]",
};

export function bucketTaskState(
  status: { name?: string; category?: string } | undefined
): TaskStateBucket {
  const name = (status?.name || "").toLowerCase();
  if (/return/.test(name)) return "Returned";
  if (/unlinked/.test(name) || status?.category === "todo") return "Unlinked";
  if (status?.category === "done") return "Complete";
  if (status?.category === "in_progress") return "Development";
  return "Development";
}
