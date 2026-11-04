import { format, subDays, differenceInDays, differenceInHours } from "date-fns";

export interface AlertRuleDefinition {
  id: string;
  name: string;
  category: "workforce" | "project" | "compliance" | "security";
  defaultSeverity: "critical" | "warning" | "info";
  description: string;
  targetRoles: ("admin" | "manager" | "hr_manager" | "project_manager" | "employee")[];
  thresholdDescription: string;
}

export interface SystemAlertItem {
  id: string;
  ruleId: string;
  ruleName: string;
  category: "workforce" | "project" | "compliance" | "security";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  entityType: "employee" | "project" | "task" | "leave" | "security";
  entityId: string;
  entityName: string;
  recipientRoles: string[];
  suggestedAction: string;
  actionHref?: string;
  createdAt: string;
  metricValue?: string | number;
  threshold?: string;
  isSnoozed?: boolean;
  snoozedUntil?: string | null;
}

export const ALERT_RULES_REGISTRY: AlertRuleDefinition[] = [
  {
    id: "RULE_01_OVERUTILIZATION",
    name: "Employee Overutilization (Burnout Risk)",
    category: "workforce",
    defaultSeverity: "critical",
    description: "Employee workload exceeds 110% net capacity over a sustained 14-day window.",
    targetRoles: ["employee", "manager", "admin"],
    thresholdDescription: "Utilization > 110% over 14 days",
  },
  {
    id: "RULE_02_UNDERUTILIZATION",
    name: "Employee Underutilization (Bench Problem)",
    category: "workforce",
    defaultSeverity: "warning",
    description: "Employee workload falls below 50% net capacity without approved leave.",
    targetRoles: ["manager", "admin"],
    thresholdDescription: "Utilization < 50% over 14 days with 0 leave",
  },
  {
    id: "RULE_03_MISSING_LOG",
    name: "Missing Daily Work Log",
    category: "compliance",
    defaultSeverity: "warning",
    description: "No daily work log submitted by 10:00 AM the following business day.",
    targetRoles: ["employee", "manager"],
    thresholdDescription: "Unsubmitted log > 1 business day",
  },
  {
    id: "RULE_04_REPEATED_LATENESS",
    name: "Chronic Lateness & Punctuality",
    category: "compliance",
    defaultSeverity: "warning",
    description: "Employee has clocked in late 3 or more times within the past 30 days.",
    targetRoles: ["employee", "manager", "hr_manager"],
    thresholdDescription: ">= 3 late arrivals in 30 days",
  },
  {
    id: "RULE_05_BUDGET_BURN",
    name: "Project Budget Burn Risk",
    category: "project",
    defaultSeverity: "critical",
    description: "Logged project hours reach 75% (warning) or 90% (critical) of budget hours.",
    targetRoles: ["project_manager", "manager", "admin"],
    thresholdDescription: "Logged hours >= 75% or >= 90% of budget",
  },
  {
    id: "RULE_06_SCHEDULE_SLIP",
    name: "Project Schedule Slippage",
    category: "project",
    defaultSeverity: "critical",
    description: "Active project has breached its baseline target delivery date.",
    targetRoles: ["project_manager", "manager", "admin"],
    thresholdDescription: "Baseline end date passed without completion",
  },
  {
    id: "RULE_07_BLOCKER_AGING",
    name: "Unresolved Blocker Aging",
    category: "project",
    defaultSeverity: "critical",
    description: "Task blocker or impediment remains unresolved for longer than 3 days.",
    targetRoles: ["project_manager", "manager"],
    thresholdDescription: "Flagged blocker age > 3 days",
  },
  {
    id: "RULE_08_TASK_IDLE",
    name: "Stale In-Progress Task",
    category: "project",
    defaultSeverity: "warning",
    description: "Task marked 'In Progress' has no work logs or activity for 3 or more days.",
    targetRoles: ["employee", "manager"],
    thresholdDescription: "In-progress task untouched > 3 days",
  },
  {
    id: "RULE_09_APPROVAL_AGING",
    name: "Leave & Request Approval Aging",
    category: "compliance",
    defaultSeverity: "warning",
    description: "Leave request or WFH application pending approval for more than 48 hours.",
    targetRoles: ["manager", "hr_manager", "admin"],
    thresholdDescription: "Approval pending > 48 hours",
  },
  {
    id: "RULE_10_CLIENT_INPUT_OVERDUE",
    name: "Client Feedback / Signoff Overdue",
    category: "project",
    defaultSeverity: "warning",
    description: "Client action item or review deliverable is past due date.",
    targetRoles: ["project_manager", "admin"],
    thresholdDescription: "Client action item due date passed",
  },
  {
    id: "RULE_11_CAPACITY_CRUNCH",
    name: "Department Capacity Crunch",
    category: "workforce",
    defaultSeverity: "critical",
    description: "Department project allocations exceed total team FTE capacity.",
    targetRoles: ["manager", "admin"],
    thresholdDescription: "Department total allocation > 100% capacity",
  },
  {
    id: "RULE_12_SECURITY_SIGNAL",
    name: "Security & System Access Anomaly",
    category: "security",
    defaultSeverity: "critical",
    description: "Elevated privilege modification or irregular session anomaly detected.",
    targetRoles: ["admin"],
    thresholdDescription: "High-privilege security event",
  },
];

// Pure evaluator functions
export function evaluateOverutilizationRule(
  users: { id: string; full_name: string; department?: string }[],
  utilizationMap: Map<string, number>
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  users.forEach((u) => {
    const util = utilizationMap.get(u.id) || 0;
    if (util > 110) {
      alerts.push({
        id: `alert-overutil-${u.id}`,
        ruleId: "RULE_01_OVERUTILIZATION",
        ruleName: "Employee Overutilization (Burnout Risk)",
        category: "workforce",
        severity: "critical",
        title: `${u.full_name} Overutilized at ${util}%`,
        description: `${u.full_name} has exceeded 110% net working capacity (${util}% logged). Action required to rebalance workload.`,
        entityType: "employee",
        entityId: u.id,
        entityName: u.full_name,
        recipientRoles: ["employee", "manager", "admin"],
        suggestedAction: "Rebalance sprint task allocations to prevent burnout",
        actionHref: `/analytics/department`,
        createdAt: new Date().toISOString(),
        metricValue: `${util}%`,
        threshold: "> 110%",
      });
    }
  });
  return alerts;
}

export function evaluateUnderutilizationRule(
  users: { id: string; full_name: string }[],
  utilizationMap: Map<string, number>,
  leaveMap: Map<string, number>
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  users.forEach((u) => {
    const util = utilizationMap.get(u.id) || 0;
    const leaveHours = leaveMap.get(u.id) || 0;
    if (util < 50 && leaveHours === 0) {
      alerts.push({
        id: `alert-underutil-${u.id}`,
        ruleId: "RULE_02_UNDERUTILIZATION",
        ruleName: "Employee Underutilization (Bench Problem)",
        category: "workforce",
        severity: "warning",
        title: `${u.full_name} Underutilized at ${util}%`,
        description: `${u.full_name} has logged only ${util}% of net capacity with 0 approved leave hours.`,
        entityType: "employee",
        entityId: u.id,
        entityName: u.full_name,
        recipientRoles: ["manager", "admin"],
        suggestedAction: "Assign open sprint tickets or assign to cross-functional stream",
        actionHref: `/analytics/department`,
        createdAt: new Date().toISOString(),
        metricValue: `${util}%`,
        threshold: "< 50%",
      });
    }
  });
  return alerts;
}

export function evaluateMissingLogsRule(
  users: { id: string; full_name: string }[],
  submittedUsersSet: Set<string>,
  dateStr: string
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  users.forEach((u) => {
    if (!submittedUsersSet.has(u.id)) {
      alerts.push({
        id: `alert-missing-log-${u.id}-${dateStr}`,
        ruleId: "RULE_03_MISSING_LOG",
        ruleName: "Missing Daily Work Log",
        category: "compliance",
        severity: "warning",
        title: `Daily Work Log Missing: ${u.full_name}`,
        description: `${u.full_name} has not submitted their work log for ${dateStr}. Daily logging is required for project tracking.`,
        entityType: "employee",
        entityId: u.id,
        entityName: u.full_name,
        recipientRoles: ["employee", "manager"],
        suggestedAction: "Nudge employee to submit yesterday's daily log",
        actionHref: `/logs/all`,
        createdAt: new Date().toISOString(),
        metricValue: "Missing",
        threshold: "Submitted by 10 AM",
      });
    }
  });
  return alerts;
}

export function evaluateRepeatedLatenessRule(
  users: { id: string; full_name: string }[],
  lateCountMap: Map<string, number>
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  users.forEach((u) => {
    const lateCount = lateCountMap.get(u.id) || 0;
    if (lateCount >= 3) {
      alerts.push({
        id: `alert-late-${u.id}`,
        ruleId: "RULE_04_REPEATED_LATENESS",
        ruleName: "Chronic Lateness & Punctuality",
        category: "compliance",
        severity: "warning",
        title: `Repeated Lateness: ${u.full_name} (${lateCount} incidents)`,
        description: `${u.full_name} has clocked in late ${lateCount} times in the past 30 days.`,
        entityType: "employee",
        entityId: u.id,
        entityName: u.full_name,
        recipientRoles: ["employee", "manager", "hr_manager"],
        suggestedAction: "Schedule a 1:1 check-in to review shift start alignment",
        actionHref: `/attendance`,
        createdAt: new Date().toISOString(),
        metricValue: `${lateCount} times`,
        threshold: ">= 3 incidents",
      });
    }
  });
  return alerts;
}

export function evaluateBudgetBurnRule(
  projects: { id: string; name: string; budget_hours?: number | null }[],
  projectLoggedHoursMap: Map<string, number>
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  projects.forEach((p) => {
    const budget = p.budget_hours || 0;
    if (budget > 0) {
      const logged = projectLoggedHoursMap.get(p.id) || 0;
      const burnPct = Math.round((logged / budget) * 100);

      if (burnPct >= 90) {
        alerts.push({
          id: `alert-budget-90-${p.id}`,
          ruleId: "RULE_05_BUDGET_BURN",
          ruleName: "Project Budget Burn Risk",
          category: "project",
          severity: "critical",
          title: `${p.name} at ${burnPct}% Budget Burn`,
          description: `${p.name} has consumed ${logged}h of its ${budget}h budget (${burnPct}% burn rate).`,
          entityType: "project",
          entityId: p.id,
          entityName: p.name,
          recipientRoles: ["project_manager", "manager", "admin"],
          suggestedAction: "Conduct scope audit or initiate client budget change order",
          actionHref: `/projects`,
          createdAt: new Date().toISOString(),
          metricValue: `${burnPct}%`,
          threshold: ">= 90%",
        });
      } else if (burnPct >= 75) {
        alerts.push({
          id: `alert-budget-75-${p.id}`,
          ruleId: "RULE_05_BUDGET_BURN",
          ruleName: "Project Budget Burn Risk",
          category: "project",
          severity: "warning",
          title: `${p.name} at ${burnPct}% Budget Burn`,
          description: `${p.name} has reached 75% threshold (${logged}h of ${budget}h consumed).`,
          entityType: "project",
          entityId: p.id,
          entityName: p.name,
          recipientRoles: ["project_manager", "manager"],
          suggestedAction: "Review remaining deliverables and velocity forecast",
          actionHref: `/projects`,
          createdAt: new Date().toISOString(),
          metricValue: `${burnPct}%`,
          threshold: ">= 75%",
        });
      }
    }
  });
  return alerts;
}

export function evaluateScheduleSlipRule(
  projects: { id: string; name: string; baseline_end_date?: string | null; status?: string }[],
  todayStr: string
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  projects.forEach((p) => {
    if (p.baseline_end_date && p.status !== "completed") {
      if (p.baseline_end_date < todayStr) {
        alerts.push({
          id: `alert-slip-${p.id}`,
          ruleId: "RULE_06_SCHEDULE_SLIP",
          ruleName: "Project Schedule Slippage",
          category: "project",
          severity: "critical",
          title: `Schedule Overrun: ${p.name}`,
          description: `${p.name} breached its baseline end date (${p.baseline_end_date}) while still active.`,
          entityType: "project",
          entityId: p.id,
          entityName: p.name,
          recipientRoles: ["project_manager", "manager", "admin"],
          suggestedAction: "Re-baseline milestones and notify project sponsors",
          actionHref: `/projects`,
          createdAt: new Date().toISOString(),
          metricValue: `Past Due (${p.baseline_end_date})`,
          threshold: `Target <= ${p.baseline_end_date}`,
        });
      }
    }
  });
  return alerts;
}

export function evaluateBlockerAgingRule(
  tasks: { id: string; title: string; is_flagged?: boolean | null; created_at: string; projects?: { name: string } }[],
  now: Date = new Date()
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  tasks.forEach((t) => {
    if (t.is_flagged) {
      const daysOld = differenceInDays(now, new Date(t.created_at));
      if (daysOld >= 3) {
        alerts.push({
          id: `alert-blocker-${t.id}`,
          ruleId: "RULE_07_BLOCKER_AGING",
          ruleName: "Unresolved Blocker Aging",
          category: "project",
          severity: "critical",
          title: `Stale Blocker: ${t.title} (${daysOld}d old)`,
          description: `Task in ${(t.projects as any)?.name || "project"} has been blocked for ${daysOld} days without resolution.`,
          entityType: "task",
          entityId: t.id,
          entityName: t.title,
          recipientRoles: ["project_manager", "manager"],
          suggestedAction: "Escalate to tech lead or product owner for unblocking",
          actionHref: `/analytics/team`,
          createdAt: new Date().toISOString(),
          metricValue: `${daysOld} days`,
          threshold: ">= 3 days",
        });
      }
    }
  });
  return alerts;
}

export function evaluateApprovalAgingRule(
  leaves: { id: string; user_id: string; created_at: string; status: string; users?: { full_name: string } }[],
  now: Date = new Date()
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  leaves.forEach((l) => {
    if (l.status === "pending") {
      const hoursOld = differenceInHours(now, new Date(l.created_at));
      if (hoursOld >= 48) {
        alerts.push({
          id: `alert-leave-aging-${l.id}`,
          ruleId: "RULE_09_APPROVAL_AGING",
          ruleName: "Leave & Request Approval Aging",
          category: "compliance",
          severity: "warning",
          title: `Pending Leave Approval: ${(l.users as any)?.full_name || "Employee"} (${Math.round(hoursOld / 24)}d)`,
          description: `Leave request has been awaiting approval for ${hoursOld} hours.`,
          entityType: "leave",
          entityId: l.id,
          entityName: `Leave Request: ${(l.users as any)?.full_name || "Employee"}`,
          recipientRoles: ["manager", "hr_manager", "admin"],
          suggestedAction: "Approve or reject pending leave request",
          actionHref: `/leave/requests`,
          createdAt: new Date().toISOString(),
          metricValue: `${hoursOld}h`,
          threshold: ">= 48h",
        });
      }
    }
  });
  return alerts;
}

export function evaluateCapacityCrunchRule(
  departments: { name: string; totalAllocationPct: number; memberCount: number }[]
): SystemAlertItem[] {
  const alerts: SystemAlertItem[] = [];
  departments.forEach((dept) => {
    if (dept.totalAllocationPct > 100 * dept.memberCount) {
      const avgAlloc = Math.round(dept.totalAllocationPct / (dept.memberCount || 1));
      alerts.push({
        id: `alert-crunch-${dept.name}`,
        ruleId: "RULE_11_CAPACITY_CRUNCH",
        ruleName: "Department Capacity Crunch",
        category: "workforce",
        severity: "critical",
        title: `Capacity Deficit: ${dept.name} (${avgAlloc}% avg FTE)`,
        description: `Total project commitments in ${dept.name} exceed available staff capacity by ${avgAlloc - 100}%.`,
        entityType: "employee",
        entityId: dept.name,
        entityName: dept.name,
        recipientRoles: ["manager", "admin"],
        suggestedAction: "Adjust roadmap deadlines or hire contingent resources",
        actionHref: `/analytics/department`,
        createdAt: new Date().toISOString(),
        metricValue: `${avgAlloc}% FTE`,
        threshold: "> 100%",
      });
    }
  });
  return alerts;
}

