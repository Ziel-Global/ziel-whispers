import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flag } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils";

export interface ProjectKanbanTabProps {
  tasks: any[];
  sprints: any[];
  workflowStatuses: any[];
  isAdmin: boolean;
  setViewTaskData: (data: any) => void;
  PRIORITY_COLORS: Record<string, string>;
  setAddTaskOpen: (b: boolean) => void;
  kanbanSprintFilter: string;
  setKanbanSprintFilter: (s: string) => void;
  kanbanPriorityFilter: string;
  setKanbanPriorityFilter: (s: string) => void;
}

export function ProjectKanbanTab({
  tasks,
  sprints,
  workflowStatuses,
  isAdmin,
  setViewTaskData,
  PRIORITY_COLORS,
  setAddTaskOpen,
  kanbanSprintFilter,
  setKanbanSprintFilter,
  kanbanPriorityFilter,
  setKanbanPriorityFilter,
}: ProjectKanbanTabProps) {
  return (
    <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Kanban Board</h2>
            <div className="flex gap-2">
              <Select value={kanbanSprintFilter} onValueChange={setKanbanSprintFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="All Sprints" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sprints</SelectItem>
                  <SelectItem value="__backlog__">Backlog</SelectItem>
                  {sprints.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kanbanPriorityFilter} onValueChange={setKanbanPriorityFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button size="sm" onClick={() => setAddTaskOpen(true)} className="rounded-button">
                  <Plus className="h-4 w-4 mr-1" />Add Task
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "500px" }}>
            {(workflowStatuses || []).filter((s: any) => s.name.toLowerCase() !== "backlog").map((status: any) => {
              const tasksInColumn = (tasks || []).filter((t: any) => {
                const statusMatch = t.status_id === status.id;
                const sprintMatch = kanbanSprintFilter === "all"
                  || (kanbanSprintFilter === "__backlog__" ? !t.sprint_id : t.sprint_id === kanbanSprintFilter);
                const priorityMatch = kanbanPriorityFilter === "all" || t.priority === kanbanPriorityFilter;
                return statusMatch && sprintMatch && priorityMatch;
              });

              return (
                <div key={status.id} className="flex-shrink-0 w-72 bg-muted/30 rounded-lg border flex flex-col">
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${(status.color || "bg-gray-400").split(" ")[0] || "bg-gray-400"}`} />
                      <span className="font-semibold text-sm capitalize">{status.name.replace(/_/g, " ")}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{tasksInColumn.length}</Badge>
                  </div>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
                    {tasksInColumn.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                    ) : (
                      tasksInColumn.map((t: any) => (
                        <div
                          key={t.id}
                          className="bg-white rounded-md p-3 border cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setViewTaskData(t)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight line-clamp-2">{t.title}</span>
                            <Badge className={`shrink-0 ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {(t as any).users?.full_name && (
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={getAvatarUrl((t as any).users?.full_name)} />
                                <AvatarFallback className="text-[8px]">{(t as any).users?.full_name?.charAt(0) || "?"}</AvatarFallback>
                              </Avatar>
                            )}
                            {(t as any).users?.full_name && (
                              <span className="text-xs text-muted-foreground truncate">{(t as any).users?.full_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {t.due_date && (
                              <span className="text-xs text-muted-foreground">Due {format(new Date(t.due_date + "T00:00:00"), "MMM d")}</span>
                            )}
                            {t.sprint_id && (() => {
                              const s = sprints.find((sp: any) => sp.id === t.sprint_id);
                              return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.name}</Badge> : null;
                            })()}
                            {t.is_flagged && <Flag className="h-3 w-3 text-red-500 shrink-0" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
    </>
  );
}
