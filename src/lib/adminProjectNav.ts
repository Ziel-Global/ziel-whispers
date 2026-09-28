export type AdminPrimaryKey =
  | "Overview"
  | "Work"
  | "Planning"
  | "People"
  | "Activity"
  | "Insights"
  | "Automation";

export type AdminNavIcon =
  | "check"
  | "grid"
  | "flag"
  | "calendar"
  | "bolt"
  | "users"
  | "building"
  | "activity"
  | "clock"
  | "trendUp"
  | "chart"
  | "bars"
  | "truck"
  | "copy"
  | "history";

export type AdminSecondaryDef = {
  key: string;
  label: string;
  tab: string;
  icon: AdminNavIcon;
  /** Key into counts prop for label suffix, e.g. Tasks (12) */
  countKey?: "tasks" | "actionItems" | "sprints" | "resources" | "clients" | "automation";
};

export const ADMIN_PRIMARY_TABS: {
  key: AdminPrimaryKey;
  label: string;
  icon: AdminNavIcon;
}[] = [
  { key: "Overview", label: "Overview", icon: "grid" },
  { key: "Work", label: "Work", icon: "check" },
  { key: "Planning", label: "Planning", icon: "calendar" },
  { key: "People", label: "People", icon: "users" },
  { key: "Activity", label: "Activity", icon: "activity" },
  { key: "Insights", label: "Insights", icon: "chart" },
  { key: "Automation", label: "Automation", icon: "bolt" },
];

export const ADMIN_SECONDARY: Record<string, AdminSecondaryDef[]> = {
  Work: [
    { key: "Tasks", label: "Tasks", tab: "tasks", icon: "check", countKey: "tasks" },
    { key: "Kanban", label: "Kanban", tab: "kanban", icon: "grid" },
    {
      key: "Action Items",
      label: "Action Items",
      tab: "action-items",
      icon: "flag",
      countKey: "actionItems",
    },
  ],
  Planning: [
    { key: "Phases", label: "Phases", tab: "phases", icon: "calendar" },
    { key: "Sprints", label: "Sprints", tab: "sprints", icon: "bolt", countKey: "sprints" },
  ],
  People: [
    { key: "Team", label: "Team", tab: "resources", icon: "users", countKey: "resources" },
    {
      key: "Client Members",
      label: "Client Members",
      tab: "clients",
      icon: "building",
      countKey: "clients",
    },
  ],
  Activity: [
    { key: "Project Activity", label: "Project Activity", tab: "status-updates", icon: "activity" },
    { key: "Time Logs", label: "Time Logs", tab: "logs", icon: "clock" },
  ],
  Insights: [
    { key: "Progress", label: "Progress", tab: "stats", icon: "trendUp" },
    { key: "Workload", label: "Workload", tab: "workload", icon: "bars" },
    { key: "Time", label: "Time", tab: "time", icon: "clock" },
    { key: "Delivery", label: "Delivery", tab: "delivery", icon: "truck" },
  ],
  Automation: [
    { key: "Rules", label: "Rules", tab: "automation-rules", icon: "bolt", countKey: "automation" },
    { key: "Templates", label: "Templates", tab: "automation-templates", icon: "copy" },
    { key: "Run History", label: "Run History", tab: "automation-run-history", icon: "history" },
  ],
};

const TAB_TO_PRIMARY: Record<string, AdminPrimaryKey> = {
  overview: "Overview",
  tasks: "Work",
  kanban: "Work",
  "action-items": "Work",
  phases: "Planning",
  sprints: "Planning",
  resources: "People",
  clients: "People",
  "status-updates": "Activity",
  logs: "Activity",
  stats: "Insights",
  workload: "Insights",
  time: "Insights",
  delivery: "Insights",
  "automation-rules": "Automation",
  "automation-templates": "Automation",
  "automation-run-history": "Automation",
};

export function primaryFromTab(tab: string): AdminPrimaryKey {
  return TAB_TO_PRIMARY[tab] || "Overview";
}

export function defaultTabForPrimary(primary: AdminPrimaryKey): string {
  if (primary === "Overview") return "overview";
  const secs = ADMIN_SECONDARY[primary];
  return secs?.[0]?.tab || "overview";
}

export const HEALTH_PILL: Record<string, { label: string; bg: string; color: string }> = {
  on_track: { label: "On Track", bg: "#DFF6E4", color: "#1B8A46" },
  needs_attention: { label: "Needs Attention", bg: "#FDF3E3", color: "#A9720B" },
  at_risk: { label: "At Risk", bg: "#FDECE3", color: "#EB5A1E" },
  delayed: { label: "Critical", bg: "#FDECEC", color: "#E5484D" },
  critical: { label: "Critical", bg: "#FDECEC", color: "#E5484D" },
};

export function healthPill(status?: string | null) {
  if (!status) return { label: "Not Assessed", bg: "#F6F5F3", color: "#8B8B92" };
  return (
    HEALTH_PILL[status] || {
      label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      bg: "#F6F5F3",
      color: "#8B8B92",
    }
  );
}
