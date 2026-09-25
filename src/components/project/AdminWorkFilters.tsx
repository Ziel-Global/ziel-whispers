import { Filter, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AdminWorkFilterState = {
  search: string;
  phaseId: string; // "all" | phase id
  sprintId: string; // "all" | "__backlog__" | sprint id
  assigneeId: string; // "all" | "__unassigned__" | user id
  statusId: string; // "all" | status id
  due: string; // "any" | "overdue" | "this_week" | "none"
};

export const DEFAULT_ADMIN_WORK_FILTERS: AdminWorkFilterState = {
  search: "",
  phaseId: "all",
  sprintId: "all",
  assigneeId: "all",
  statusId: "all",
  due: "any",
};

export function filterAdminWorkTasks(
  tasks: any[],
  sprints: any[],
  filters: AdminWorkFilterState
): any[] {
  const q = filters.search.trim().toLowerCase();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return (tasks || []).filter((t: any) => {
    if (q) {
      const hay = `${t.title || ""} ${t.description || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.sprintId === "__backlog__") {
      if (t.sprint_id) return false;
    } else if (filters.sprintId !== "all" && t.sprint_id !== filters.sprintId) {
      return false;
    }
    if (filters.phaseId !== "all") {
      const sprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
      const phaseId = t.phase_id || sprint?.phase_id;
      if (phaseId !== filters.phaseId) return false;
    }
    if (filters.assigneeId === "__unassigned__") {
      if (t.assigned_to) return false;
    } else if (filters.assigneeId !== "all" && t.assigned_to !== filters.assigneeId) {
      return false;
    }
    if (filters.statusId !== "all" && t.status_id !== filters.statusId) {
      return false;
    }
    if (filters.due === "none") {
      if (t.due_date) return false;
    } else if (filters.due === "overdue") {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      if (d >= now) return false;
    } else if (filters.due === "this_week") {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      if (d < now || d > weekEnd) return false;
    }
    return true;
  });
}

type Props = {
  filters: AdminWorkFilterState;
  onChange: (next: AdminWorkFilterState) => void;
  phases: any[];
  sprints: any[];
  workflowStatuses: any[];
  assigneeOptions: { id: string; name: string }[];
};

const pillTrigger =
  "h-auto w-auto min-w-0 border border-black/[0.08] rounded-[10px] px-[13px] py-[9px] text-[12.5px] font-semibold text-[#4B4B52] bg-white shadow-none gap-1.5 whitespace-nowrap";

export function AdminWorkFilters({
  filters,
  onChange,
  phases,
  sprints,
  workflowStatuses,
  assigneeOptions,
}: Props) {
  const set = (patch: Partial<AdminWorkFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-4">
      <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-[9px]">
        <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0" strokeWidth={2} />
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search tasks..."
          className="border-0 bg-transparent outline-none text-[13px] flex-1 min-w-0 font-inherit placeholder:text-[#8B8B92]"
        />
      </div>

      <Select value={filters.phaseId} onValueChange={(v) => set({ phaseId: v })}>
        <SelectTrigger className={pillTrigger}>
          <SelectValue placeholder="Phase: All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Phase: All</SelectItem>
          {(phases || []).map((p: any) => (
            <SelectItem key={p.id} value={p.id}>
              Phase: {p.title || p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.sprintId} onValueChange={(v) => set({ sprintId: v })}>
        <SelectTrigger className={pillTrigger}>
          <SelectValue placeholder="Sprint: All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Sprint: All</SelectItem>
          <SelectItem value="__backlog__">Sprint: Backlog</SelectItem>
          {(sprints || []).map((s: any) => (
            <SelectItem key={s.id} value={s.id}>
              Sprint: {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.assigneeId} onValueChange={(v) => set({ assigneeId: v })}>
        <SelectTrigger className={pillTrigger}>
          <SelectValue placeholder="Assignee: All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Assignee: All</SelectItem>
          <SelectItem value="__unassigned__">Assignee: Unassigned</SelectItem>
          {assigneeOptions.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              Assignee: {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.statusId} onValueChange={(v) => set({ statusId: v })}>
        <SelectTrigger className={pillTrigger}>
          <SelectValue placeholder="Status: All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Status: All</SelectItem>
          {(workflowStatuses || []).map((s: any) => (
            <SelectItem key={s.id} value={s.id}>
              Status: {s.name.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.due} onValueChange={(v) => set({ due: v })}>
        <SelectTrigger className={pillTrigger}>
          <SelectValue placeholder="Due: Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Due: Any</SelectItem>
          <SelectItem value="overdue">Due: Overdue</SelectItem>
          <SelectItem value="this_week">Due: This week</SelectItem>
          <SelectItem value="none">Due: None</SelectItem>
        </SelectContent>
      </Select>

      <div className="inline-flex items-center gap-1.5 bg-white border border-black/[0.08] rounded-[10px] px-[13px] py-[9px] text-[12.5px] font-semibold text-[#4B4B52] whitespace-nowrap cursor-default select-none">
        <Filter className="h-[13px] w-[13px]" strokeWidth={2} />
        More Filters
      </div>
    </div>
  );
}

export function initialsFromName(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export const PRIORITY_TEXT: Record<string, string> = {
  high: "#E5484D",
  medium: "#C7860F",
  low: "#6B6B72",
};

export const AVATAR_COLORS = [
  { bg: "#FDECE3", color: "#EB5A1E" },
  { bg: "#E6E9FF", color: "#4C57D9" },
  { bg: "#DFF6E4", color: "#1FAA59" },
  { bg: "#FDF3E3", color: "#A9720B" },
];

export function avatarStyleFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
