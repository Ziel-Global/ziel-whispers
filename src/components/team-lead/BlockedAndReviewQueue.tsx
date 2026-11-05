import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Eye, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { ReviewOrBlockedTask } from "@/hooks/useTeamLeadData";

interface BlockedAndReviewQueueProps {
  tasks: ReviewOrBlockedTask[];
  onTaskClick?: (taskId: string) => void;
}

export function BlockedAndReviewQueue({ tasks, onTaskClick }: BlockedAndReviewQueueProps) {
  const blockedTasks = tasks.filter((t) => t.isFlagged);
  const reviewTasks = tasks.filter((t) => !t.isFlagged);

  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Action Queue: Blockers & Code Reviews
            </h3>
            <p className="text-xs text-muted-foreground">
              Items requiring team lead decision, PR approval, or impediment clearing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {blockedTasks.length > 0 && (
            <Badge variant="destructive" className="text-xs font-semibold">
              {blockedTasks.length} Blocked
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-semibold">
            {reviewTasks.length} In Review
          </Badge>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-foreground">Zero Blockers or Bottlenecks</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            All team sprint tasks are moving cleanly with no review pile-up or active escalations.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task.id)}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] px-2 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5">
                  {task.isFlagged ? (
                    <span className="p-1 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 inline-block">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 inline-block">
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground hover:underline">
                      {task.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                      {task.projectName}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span>
                      Assignee: <strong className="text-foreground">{task.assigneeName}</strong>
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Due {task.dueDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold uppercase ${
                    task.priority === "high"
                      ? "text-rose-600 border-rose-300"
                      : "text-blue-600 border-blue-300"
                  }`}
                >
                  {task.priority}
                </Badge>

                <Badge
                  variant={task.isFlagged ? "destructive" : "secondary"}
                  className="text-[11px] font-medium"
                >
                  {task.isFlagged ? "Blocked" : task.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

