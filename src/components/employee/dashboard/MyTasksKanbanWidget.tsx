import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListTodo, AlertCircle, Calendar, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toSlug } from "@/lib/utils";

export interface MyTasksKanbanWidgetProps {
  tasks: any[];
}

export function MyTasksKanbanWidget({ tasks }: MyTasksKanbanWidgetProps) {
  const navigate = useNavigate();

  // Bucket tasks by category
  const columns = useMemo(() => {
    const todo: any[] = [];
    const inProgress: any[] = [];
    const review: any[] = [];
    const done: any[] = [];

    tasks.forEach((t) => {
      const category = t.workflow_statuses?.category || "todo";
      const statusName = (t.workflow_statuses?.name || "").toLowerCase();

      if (category === "done") {
        done.push(t);
      } else if (category === "in_progress") {
        if (statusName.includes("review") || statusName.includes("qa") || statusName.includes("test")) {
          review.push(t);
        } else {
          inProgress.push(t);
        }
      } else {
        todo.push(t);
      }
    });

    return [
      { key: "todo", title: "To Do / Backlog", items: todo, color: "border-l-slate-400" },
      { key: "in_progress", title: "In Progress", items: inProgress, color: "border-l-blue-500" },
      { key: "review", title: "Review & QA", items: review, color: "border-l-purple-500" },
      { key: "done", title: "Completed", items: done.slice(0, 10), color: "border-l-emerald-500" },
    ];
  }, [tasks]);

  return (
    <Card className="p-5 border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-foreground" />
          <h2 className="text-base font-bold tracking-tight text-foreground">
            My Tasks Board
          </h2>
          <Badge variant="secondary" className="text-xs font-semibold">
            {tasks.length} Total
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Status advances automatically upon hour-attributed work log submission
        </span>
      </div>

      {/* 4-column responsive personal Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map((col) => (
          <div
            key={col.key}
            className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl p-3 flex flex-col h-[340px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-xs font-bold text-foreground">{col.title}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold">
                {col.items.length}
              </Badge>
            </div>

            {/* Task Cards Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {col.items.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                  No tasks
                </div>
              ) : (
                col.items.map((task) => {
                  const projectSlug = toSlug(task.projects?.name || task.project_id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/projects/${projectSlug}?tab=tasks&taskId=${task.id}`)}
                      className={`p-2.5 bg-background border border-black/[0.08] dark:border-white/[0.08] rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4 ${col.color}`}
                    >
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-2">
                        {task.title}
                      </p>
                      {task.is_flagged && (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground truncate mb-2">
                      {task.projects?.name || "Unassigned Project"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1 py-0 font-medium ${
                          task.priority === "high"
                            ? "bg-red-50 text-red-700"
                            : task.priority === "medium"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        {task.priority || "normal"}
                      </Badge>

                      {task.due_date && (
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {format(parseISO(task.due_date), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
