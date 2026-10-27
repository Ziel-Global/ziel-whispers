export const APP_VERSION = "v1.1.0";

export const DEPARTMENTS = [
  "Engineering",
  "Design",
  "HR",
  "Marketing",
  "Operations",
  "Finance",
  "SQA",
  "Management",
  "Sales",
  "Other",
] as const;

export type Department = typeof DEPARTMENTS[number];

export const EMP_TYPES = ["full-time", "part-time", "contract"] as const;
export type EmploymentType = typeof EMP_TYPES[number];

export const ROLES = [
  "admin",
  "manager",
  "hr_manager",
  "project_manager",
  "employee",
  "client",
  "client member",
] as const;
export type AppRole = typeof ROLES[number];

export const REMINDER_OPTIONS = [15, 30, 60] as const;

export const PROJECT_STATUSES = [
  "active",
  "on_hold",
  "completed",
  "archived",
] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export function empTypeLabel(t?: string | null): string {
  if (!t) return "Full-Time";
  if (t === "full-time") return "Full-Time";
  if (t === "part-time") return "Part-Time";
  if (t === "contract") return "Contract";
  return t;
}

export function roleLabel(r?: string | null): string {
  if (!r) return "Employee";
  if (r === "admin") return "Administrator";
  if (r === "hr_manager") return "HR / Operational Manager";
  if (r === "project_manager") return "Project Manager";
  if (r === "client member") return "Client Member";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function statusLabel(s?: string | null): string {
  return (s || "active").charAt(0).toUpperCase() + (s || "active").slice(1);
}
