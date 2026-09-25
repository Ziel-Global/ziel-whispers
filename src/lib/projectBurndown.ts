export function computeBurndownData({
  burndownScope,
  phases,
  tasks,
  sprints,
  logs,
  project,
}: {
  burndownScope: string;
  phases: any[];
  tasks: any[];
  sprints: any[];
  logs: any[];
  project: any;
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
  const logged = scopeTasks.reduce((s: number, t: any) => {
    const taskLogs = (logs || []).filter((l: any) => l.task_id === t.id);
    return s + taskLogs.reduce((sum: number, l: any) => sum + Number(l.hours), 0);
  }, 0);
  const remaining = Math.max(0, totalEst - logged);
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
