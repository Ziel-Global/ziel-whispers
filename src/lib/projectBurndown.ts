export function computeBurndownData({
  burndownScope,
  phases,
  tasks,
  sprints,
  logs,
  project,
  workflowStatuses,
}: {
  burndownScope: string;
  phases: any[];
  tasks: any[];
  sprints: any[];
  logs: any[];
  project: any;
  /** Client portal only. When passed, remaining is status-based; when omitted (admin charts), the original formula is used. */
  workflowStatuses?: any[];
}) {
  const scopeTasks =
    burndownScope === "project"
      ? tasks || []
      : (tasks || []).filter((t: any) => {
          const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
          return taskSprint?.phase_id === burndownScope;
        });
  const estimated = scopeTasks.filter((t: any) => t.estimated_hours != null);
  const unestimated = scopeTasks.filter((t: any) => t.estimated_hours == null);
  const totalEst = estimated.reduce((s: number, t: any) => s + Number(t.estimated_hours), 0);
  const loggedFor = (taskId: string) =>
    (logs || []).filter((l: any) => l.task_id === taskId).reduce((sum: number, l: any) => sum + Number(l.hours), 0);
  const logged = scopeTasks.reduce((s: number, t: any) => s + loggedFor(t.id), 0);

  let remaining: number;
  if (workflowStatuses) {
    // Client: done = 0 left; open = estimate minus its own logged hours (never below 0).
    // Status-based because the client portal can't read team logs.
    const doneIds = new Set(workflowStatuses.filter((s: any) => s.category === "done").map((s: any) => s.id));
    const isDone = (t: any) => !!t.completed_at || (!!t.status_id && doneIds.has(t.status_id));
    remaining = estimated.reduce(
      (s: number, t: any) => s + (isDone(t) ? 0 : Math.max(0, Number(t.estimated_hours) - loggedFor(t.id))),
      0
    );
  } else {
    remaining = Math.max(0, totalEst - logged);
  }

  const scopePhase = burndownScope !== "project" ? phases.find((p: any) => p.id === burndownScope) : null;
  const endDate = scopePhase?.due_date || project?.end_date;
  const startDate = project?.start_date;

  if (estimated.length === 0) {
    return { error: "No estimated tasks to show burndown." as const };
  }
  if (!endDate || !startDate) {
    return { error: "Project needs start and end dates for burndown." as const };
  }

  const daysTotal = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
  );
  const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86400000));
  const idealPerDay = totalEst / daysTotal;
  const idealRemaining = Math.max(0, totalEst - idealPerDay * Math.min(daysElapsed, daysTotal));

  return {
    totalEst,
    logged,
    remaining,
    unestimated,
    burndownData: [
      { name: "Start", ideal: totalEst, actual: totalEst },
      { name: "Now", ideal: idealRemaining, actual: remaining },
      { name: "Due", ideal: 0, actual: null as number | null },
    ],
  };
}
