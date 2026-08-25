import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { Pencil, Trash2 } from "lucide-react";

export interface ProjectSprintsTabProps {
  tasks: any[];
  sprints: any[];
  phases: any[];
  isAdmin: boolean;
  setAddSprintOpen: (b: boolean) => void;
  sprintTaskCount: Record<string, number>;
  sprintProgress: Record<string, number>;
  openEditSprint: (sprint: any) => void;
  deleteSprint: (id: string) => void;
  openSprintTasks: (sprint: any) => void;
}

export function ProjectSprintsTab({
  tasks,
  sprints,
  phases,
  isAdmin,
  setAddSprintOpen,
  sprintTaskCount,
  sprintProgress,
  openEditSprint,
  deleteSprint,
  openSprintTasks,
}: ProjectSprintsTabProps) {
  return (
    <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sprints</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setAddSprintOpen(true)} className="rounded-button bg-primary text-black hover:bg-black hover:text-white active:bg-black">
                <Plus className="h-4 w-4 mr-1" /> Add Sprint
              </Button>
            )}
          </div>
          {sprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sprints yet.</p>
          ) : isAdmin ? (
            <div className="space-y-6">
              {(phases || [])
                .filter((p: any) => sprints.some((s: any) => s.phase_id === p.id))
                .map((phase: any) => {
                  const phaseSprints = sprints.filter((s: any) => s.phase_id === phase.id);
                  return (
                    <div key={phase.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-sm">{phase.title}</h4>
                        <Badge variant="outline" className="text-[10px]">{phaseSprints.length} sprint{phaseSprints.length !== 1 ? "s" : ""}</Badge>
                      </div>
                      <div>
                        <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
                          <span>SPRINT</span>
                          <span>DATES</span>
                          <span>STATUS</span>
                          <span>TASKS</span>
                          <span>PROGRESS</span>
                          <span className="text-right">ACTIONS</span>
                        </TableHeader>
                        {phaseSprints.map((s: any) => (
                          <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
                            <div>
                              <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
                              <RowSecondary>{sprintTaskCount[s.id] || 0} tasks</RowSecondary>
                            </div>
                            <RowDataItem label="DATES">
                              {format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}
                            </RowDataItem>
                            <RowBadgeItem label="STATUS">
                              <Badge className={
                                s.status === "active" ? "bg-green-100 text-green-800" :
                                s.status === "completed" ? "bg-blue-100 text-blue-800" :
                                "bg-gray-100 text-gray-800"
                              }>{s.status}</Badge>
                            </RowBadgeItem>
                            <RowDataItem label="TASKS">{sprintTaskCount[s.id] || 0}</RowDataItem>
                            <RowDataItem label="PROGRESS">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-muted rounded-full h-2">
                                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${sprintProgress[s.id]}%` }} />
                                </div>
                                <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                              </div>
                            </RowDataItem>
                            <RowActions className="justify-self-end">
                              {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); openEditSprint(s); }} className={editButtonClass} title="Edit Sprint">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); deleteSprint(s.id); }} className={editButtonClass} title="Delete Sprint">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </button>
                              )}
                            </RowActions>
                          </DataRow>
                        ))}
                      </div>
                    </div>
                  );
                })}
              {sprints.some((s: any) => !s.phase_id) && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Unassigned</h4>
                  <div>
                    <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
                      <span>SPRINT</span>
                      <span>DATES</span>
                      <span>STATUS</span>
                      <span>TASKS</span>
                      <span>PROGRESS</span>
                      <span className="text-right">ACTIONS</span>
                    </TableHeader>
                    {sprints.filter((s: any) => !s.phase_id).map((s: any) => (
                      <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
                        <div>
                          <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
                          <RowSecondary>{sprintTaskCount[s.id] || 0} tasks</RowSecondary>
                        </div>
                        <RowDataItem label="DATES">
                          {format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}
                        </RowDataItem>
                        <RowBadgeItem label="STATUS">
                          <Badge className={
                            s.status === "active" ? "bg-green-100 text-green-800" :
                            s.status === "completed" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }>{s.status}</Badge>
                        </RowBadgeItem>
                        <RowDataItem label="TASKS">{sprintTaskCount[s.id] || 0}</RowDataItem>
                        <RowDataItem label="PROGRESS">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${sprintProgress[s.id]}%` }} />
                            </div>
                            <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                          </div>
                        </RowDataItem>
                        <RowActions className="justify-self-end">
                          {isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); openEditSprint(s); }} className={editButtonClass} title="Edit Sprint">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); deleteSprint(s.id); }} className={editButtonClass} title="Delete Sprint">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          )}
                        </RowActions>
                      </DataRow>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
                <span>SPRINT</span>
                <span>DATES</span>
                <span>STATUS</span>
                <span>TASKS</span>
                <span>PROGRESS</span>
              </TableHeader>
              {sprints.map((s: any) => (
                <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
                  <div>
                    <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
                    <RowSecondary>{sprintTaskCount[s.id] || 0} tasks</RowSecondary>
                  </div>
                  <RowDataItem label="DATES">
                    {format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}
                  </RowDataItem>
                  <RowBadgeItem label="STATUS">
                    <Badge className={
                      s.status === "active" ? "bg-green-100 text-green-800" :
                      s.status === "completed" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-800"
                    }>{s.status}</Badge>
                  </RowBadgeItem>
                  <RowDataItem label="TASKS">{sprintTaskCount[s.id] || 0}</RowDataItem>
                  <RowDataItem label="PROGRESS">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${sprintProgress[s.id]}%` }} />
                      </div>
                      <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                    </div>
                  </RowDataItem>
                </DataRow>
              ))}
            </div>
          )}
    </>
  );
}
