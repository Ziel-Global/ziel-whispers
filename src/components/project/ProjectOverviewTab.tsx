import React from 'react';
import { format } from "date-fns";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

export interface ProjectOverviewTabProps {
  project: any;
  latestHealth: any;
  workflowTemplate: any;
  isAdmin: boolean;
  isClient: boolean;
  STATUS_OPTIONS: string[];
  changeStatus: (s: string) => void;
  statusNote: string;
  setStatusNote: (s: string) => void;
  saveStatusNote: () => void;
  portalMessages: any[];
  burndownScope: string;
  setBurndownScope: (s: string) => void;
  phases: any[];
  tasks: any[];
  sprints: any[];
  logs: any[];
  statusUpdatesLoading: boolean;
  statusUpdates: any[];
  getAvatarUrl: (name: string) => string;
  newStatusUpdate: string;
  setNewStatusUpdate: (s: string) => void;
  newStatusUpdateVisible: boolean;
  setNewStatusUpdateVisible: (v: boolean) => void;
  addStatusUpdate: () => void;
}

export function ProjectOverviewTab({
  project,
  latestHealth,
  workflowTemplate,
  isAdmin,
  isClient,
  STATUS_OPTIONS,
  changeStatus,
  statusNote,
  setStatusNote,
  saveStatusNote,
  portalMessages,
  burndownScope,
  setBurndownScope,
  phases,
  tasks,
  sprints,
  logs,
  statusUpdatesLoading,
  statusUpdates,
  getAvatarUrl,
  newStatusUpdate,
  setNewStatusUpdate,
  newStatusUpdateVisible,
  setNewStatusUpdateVisible,
  addStatusUpdate,
}: ProjectOverviewTabProps) {
  return (
    <>
      <Card className="p-6 space-y-4">
        {project.description && <p className="text-muted-foreground">{project.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <div><span className="text-muted-foreground block">Client</span><span className="font-medium">{(project.clients as any)?.name}</span></div>
          <div><span className="text-muted-foreground block">Start Date</span><span className="font-medium">{format(new Date(project.start_date), "MMM d, yyyy")}</span></div>
          <div><span className="text-muted-foreground block">End Date</span><span className="font-medium">{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "—"}</span></div>
          <div><span className="text-muted-foreground block">Status</span><span className="font-medium">{project.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
          <div>
            <span className="text-muted-foreground block">Health</span>
            {latestHealth ? (
              <Badge className={
                latestHealth.health_status === "on_track" ? "bg-green-100 text-green-800" :
                latestHealth.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }>
                {latestHealth.health_status.replace(/_/g, " ")}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div><span className="text-muted-foreground block">Workflow</span><span className="font-medium">{workflowTemplate?.name || "—"}</span></div>
        </div>
        {(project as any).document_link && (
          <div className="pt-2">
            <span className="text-sm text-muted-foreground block mb-1">Document / Drive Link</span>
            <Button variant="outline" size="sm" className="rounded-button" asChild>
              <a
                href={(project as any).document_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open Document
              </a>
            </Button>
          </div>
        )}
        {isAdmin && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <span className="text-sm font-medium block mb-1">Change Status</span>
                <Select value={project.status} onValueChange={changeStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">Status Note</span>
              <div className="flex gap-2">
                <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} className="flex-1" />
                <Button variant="outline" size="sm" onClick={saveStatusNote}>Save</Button>
              </div>
            </div>
          </div>
        )}
        {!isAdmin && project.status === "on_hold" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">This project is currently on hold.</div>
        )}

        {/* Portal Messages — visible to all */}
        {portalMessages.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <h3 className="text-sm font-semibold">Messages</h3>
            {portalMessages.map((m: any) => (
              <div key={m.id} className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="text-sm font-semibold">{m.title}</h4>
                {m.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.body}</p>}
                {m.cta_label && m.cta_url && (
                  <a href={m.cta_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-2">
                    {m.cta_label} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Burndown Chart — admin/employee only (hours-based) */}
        {!isClient && (
          <>
            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Burndown</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Scope:</label>
                  <Select value={burndownScope} onValueChange={setBurndownScope}>
                    <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      {phases.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const scopeTasks = burndownScope === "project"
                  ? (tasks || [])
                  : (tasks || []).filter((t: any) => {
                      const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
                      return taskSprint?.phase_id === burndownScope;
                    })
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
                  return <p className="text-xs text-muted-foreground py-4">No estimated tasks to show burndown.</p>;
                }

                if (!endDate || !startDate) {
                  return <p className="text-xs text-muted-foreground py-4">Project needs start and end dates for burndown.</p>;
                }

                const daysTotal = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
                const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86400000));
                const idealPerDay = totalEst / daysTotal;
                const idealRemaining = Math.max(0, totalEst - idealPerDay * Math.min(daysElapsed, daysTotal));

                const burndownData = [
                  { name: "Start", ideal: totalEst, actual: totalEst },
                  { name: "Now", ideal: idealRemaining, actual: remaining },
                  { name: "Due", ideal: 0, actual: null },
                ];

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <span>Total estimated: <strong>{totalEst}h</strong></span>
                      <span>Logged: <strong>{logged.toFixed(1)}h</strong></span>
                      <span>Remaining: <strong>{remaining.toFixed(1)}h</strong></span>
                      {unestimated.length > 0 && (
                        <span className="text-yellow-600">Unestimated: <strong>{unestimated.length} task{unestimated.length > 1 ? "s" : ""}</strong></span>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={burndownData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="ideal" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Ideal" />
                        <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls name="Actual" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Status Updates — admin/employee only */}
        {!isClient && (
          <>
            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Status Updates</h3>
              {statusUpdatesLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : statusUpdates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status updates yet.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {statusUpdates.map((u: any) => (
                    <div key={u.id} className="flex gap-2 bg-muted/30 rounded-md p-3">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                        <AvatarFallback className="text-[10px]">{u.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), "MMM d, h:mm a")}</span>
                          {u.visible_to_client ? (
                            <Eye className="h-3 w-3 text-muted-foreground" title="Visible to client" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-muted-foreground" title="Internal only" />
                          )}
                        </div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{u.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-start">
                <Textarea
                  value={newStatusUpdate}
                  onChange={(e) => setNewStatusUpdate(e.target.value)}
                  placeholder="Post a status update..."
                  rows={2}
                  className="text-sm resize-none flex-1"
                />
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Checkbox id="status-update-visible" checked={newStatusUpdateVisible} onCheckedChange={(v) => setNewStatusUpdateVisible(v === true)} />
                    <label htmlFor="status-update-visible" className="text-[10px] cursor-pointer text-muted-foreground">Visible to client</label>
                  </div>
                  <Button type="button" size="sm" onClick={addStatusUpdate} disabled={!newStatusUpdate.trim()} className="shrink-0">Post</Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}