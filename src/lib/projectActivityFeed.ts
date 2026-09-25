import { format, isBefore, startOfDay } from "date-fns";
import {
  AlertTriangle,
  Check,
  Clock,
  Flag,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type ProjectActivityItem = {
  key: string;
  text: string;
  time: string;
  iconBg: string;
  iconColor: string;
  Icon: LucideIcon;
  sortAt: number;
};

export type BuildProjectActivityFeedInput = {
  tasks?: any[];
  workflowStatuses?: any[];
  openBlockers?: { description?: string | null; status?: string }[];
  statusUpdates?: any[];
  sprints?: any[];
  resourceMembers?: any[];
  /** Cap after sorting newest-first. Omit for uncapped (Activity tab). */
  limit?: number;
};

export function buildProjectActivityFeed({
  tasks = [],
  workflowStatuses = [],
  openBlockers = [],
  statusUpdates = [],
  sprints = [],
  resourceMembers = [],
  limit,
}: BuildProjectActivityFeedInput): ProjectActivityItem[] {
  const today = startOfDay(new Date());
  const doneIds = new Set(
    (workflowStatuses || []).filter((s: any) => s.category === "done").map((s: any) => s.id)
  );
  const isDone = (t: any) => !!t.completed_at || (t.status_id && doneIds.has(t.status_id));

  const openTasks = tasks.filter((t: any) => !isDone(t));
  const overdueTasks = openTasks.filter(
    (t: any) => t.due_date && isBefore(startOfDay(new Date(t.due_date)), today)
  );
  const recentlyCompleted = tasks
    .filter(isDone)
    .sort((a: any, b: any) => {
      const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return db - da;
    });

  const items: ProjectActivityItem[] = [];

  overdueTasks.forEach((t: any) => {
    const due = t.due_date ? new Date(t.due_date + "T00:00:00").getTime() : 0;
    items.push({
      key: `overdue-${t.id}`,
      text: `"${t.title}" is overdue`,
      time: t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "",
      iconBg: "#FDF3E3",
      iconColor: "#A9720B",
      Icon: Clock,
      sortAt: due || Date.now(),
    });
  });

  openBlockers.forEach((b: any, i: number) => {
    items.push({
      key: `blocker-${i}-${b.description || ""}`,
      text: b.description || "Open blocker needs resolution",
      time: "",
      iconBg: "#FDECEC",
      iconColor: "#E5484D",
      Icon: AlertTriangle,
      sortAt: Date.now() - i,
    });
  });

  recentlyCompleted.forEach((t: any) => {
    const completedAt = t.completed_at ? new Date(t.completed_at).getTime() : 0;
    items.push({
      key: `done-${t.id}`,
      text: `"${t.title}" was completed`,
      time: t.completed_at ? format(new Date(t.completed_at), "MMM d, h:mm a") : "",
      iconBg: "#DFF6E4",
      iconColor: "#1FAA59",
      Icon: Check,
      sortAt: completedAt,
    });
  });

  (statusUpdates || []).forEach((u: any) => {
    const created = u.created_at ? new Date(u.created_at).getTime() : 0;
    items.push({
      key: `su-${u.id}`,
      text: u.summary || "Status update posted",
      time: u.created_at ? format(new Date(u.created_at), "MMM d, h:mm a") : "",
      iconBg: "#FDECE3",
      iconColor: "#EB5A1E",
      Icon: Flag,
      sortAt: created,
    });
  });

  (sprints || [])
    .filter((s: any) => s.status === "completed" || s.status === "done")
    .forEach((s: any) => {
      const end = s.end_date ? new Date(s.end_date + "T00:00:00").getTime() : 0;
      items.push({
        key: `sprint-done-${s.id}`,
        text: `Sprint "${s.name}" completed`,
        time: s.end_date ? format(new Date(s.end_date + "T00:00:00"), "MMM d") : "",
        iconBg: "#E6E9FF",
        iconColor: "#4C57D9",
        Icon: Zap,
        sortAt: end,
      });
    });

  (resourceMembers || [])
    .slice()
    .sort((a: any, b: any) => {
      const da = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
      const db = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
      return db - da;
    })
    .slice(0, 8)
    .forEach((m: any) => {
      const name = m.users?.full_name || "Team member";
      const assigned = m.assigned_at ? new Date(m.assigned_at).getTime() : 0;
      items.push({
        key: `member-${m.id}`,
        text: `${name} joined the project team`,
        time: m.assigned_at ? format(new Date(m.assigned_at), "MMM d, yyyy") : "",
        iconBg: "#F5E8FF",
        iconColor: "#7B4DB8",
        Icon: UserPlus,
        sortAt: assigned,
      });
    });

  items.sort((a, b) => b.sortAt - a.sortAt);

  if (limit != null && limit > 0) {
    return items.slice(0, limit);
  }
  return items;
}
