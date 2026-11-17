function toDateStr(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date && !isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function computeBurndownData({
  burndownScope = "project",
  phases = [],
  tasks = [],
  sprints = [],
  logs = [], // kept for backwards-compatibility with existing callers
  project,
  workflowStatuses = [],
}: {
  burndownScope?: string;
  phases?: any[];
  tasks?: any[];
  sprints?: any[];
  logs?: any[];
  project?: any;
  workflowStatuses?: any[];
}) {
  const scopeTasks =
    burndownScope === "project"
      ? tasks || []
      : (tasks || []).filter((t: any) => {
          const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
          return taskSprint?.phase_id === burndownScope;
        });

  const scopePhase =
    burndownScope !== "project"
      ? (phases || []).find((p: any) => p.id === burndownScope)
      : null;

  const startDateRaw = project?.start_date;
  const endDateRaw = scopePhase?.due_date || project?.end_date;

  if (!startDateRaw || !endDateRaw) {
    return { error: "Project needs start and end dates for burndown." as const };
  }

  const startStr = toDateStr(startDateRaw);
  let endStr = toDateStr(endDateRaw);

  if (!startStr || !endStr) {
    return { error: "Project needs start and end dates for burndown." as const };
  }

  if (endStr < startStr) {
    endStr = startStr;
  }

  const doneStatusIds = new Set(
    (workflowStatuses || [])
      .filter((s: any) => s.category === "done")
      .map((s: any) => s.id)
  );

  const getTaskCompletionDate = (t: any): string | null => {
    if (t.completed_at) {
      return toDateStr(t.completed_at);
    }
    const isDone =
      (t.status_id && doneStatusIds.has(t.status_id)) ||
      t.status === "complete" ||
      t.status === "done";
    if (isDone) {
      return toDateStr(t.updated_at || t.created_at || new Date());
    }
    return null;
  };

  const totalTasks = scopeTasks.length;
  const completedTasks = scopeTasks.filter((t: any) => getTaskCompletionDate(t) !== null).length;
  const remainingTasks = Math.max(0, totalTasks - completedTasks);

  if (totalTasks === 0) {
    return { error: "No tasks to show burndown." as const };
  }

  // Generate daily date array from startStr to endStr
  const todayStr = toDateStr(new Date())!;
  const days: string[] = [];

  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);

  const curr = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let safety = 0;
  while (curr <= end && safety < 1000) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, "0");
    const d = String(curr.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
    safety++;
  }

  if (days.length === 0) {
    days.push(startStr);
  }

  const daysTotal = Math.max(1, days.length - 1);

  const burndownData = days.map((dayStr, index) => {
    const ideal = Math.max(
      0,
      Math.round((totalTasks - (index / daysTotal) * totalTasks) * 10) / 10
    );

    let actual: number | null = null;
    if (dayStr <= todayStr) {
      const completedOnOrBefore = scopeTasks.filter((t: any) => {
        const cDate = getTaskCompletionDate(t);
        return cDate !== null && cDate <= dayStr;
      }).length;
      actual = Math.max(0, totalTasks - completedOnOrBefore);
    }

    return {
      name: formatDayLabel(dayStr),
      date: dayStr,
      ideal,
      actual,
    };
  });

  return {
    totalTasks,
    completedTasks,
    remainingTasks,
    // Backwards-compatible aliases:
    totalEst: totalTasks,
    logged: completedTasks,
    remaining: remainingTasks,
    unestimated: [],
    burndownData,
  };
}
