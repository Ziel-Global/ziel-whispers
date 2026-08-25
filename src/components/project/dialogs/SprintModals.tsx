import { getStatusDisplay, getStatusColor } from "@/lib/workflow";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty, CommandGroup } from "@/components/ui/command";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X } from "lucide-react";

export interface SprintModalsProps {
  addSprintOpen: boolean; setAddSprintOpen: (open: boolean) => void;
  editSprintOpen: boolean; setEditSprintOpen: (open: boolean) => void;
  sprintTasksOpen: boolean; setSprintTasksOpen: (open: boolean) => void;
  selectedSprint: any;
  sprintName: string; setSprintName: (v: string) => void;
  sprintStartDate: string; setSprintStartDate: (v: string) => void;
  sprintEndDate: string; setSprintEndDate: (v: string) => void;
  sprintPhaseId: string; setSprintPhaseId: (v: string) => void;
  sprintTaskIds: string[]; setSprintTaskIds: (v: string[]) => void;
  sprintTaskSearch: string; setSprintTaskSearch: (v: string) => void;
  editSprintId: string | null; setEditSprintId: (v: string | null) => void;
  editSprintName: string; setEditSprintName: (v: string) => void;
  editSprintStartDate: string; setEditSprintStartDate: (v: string) => void;
  editSprintEndDate: string; setEditSprintEndDate: (v: string) => void;
  editSprintStatus: string; setEditSprintStatus: (v: string) => void;
  editSprintPhaseId: string; setEditSprintPhaseId: (v: string) => void;
  editSprintTaskIds: string[]; setEditSprintTaskIds: (v: string[]) => void;
  createSprint: (e: React.FormEvent) => void;
  handleEditSprintSave: (e: React.FormEvent) => void;
  tasks: any[];
  phases: any[];
  openEditTask?: (task: any) => void;
  setViewTaskData?: (task: any) => void;
  PRIORITY_COLORS: Record<string, string>;
  sprintTaskCount?: Record<string, number>;
  workflowStatuses?: any[];
  doneStatusIds?: Set<string> | any;
}

export function SprintModals(props: SprintModalsProps) {
  const statusColor = (statusId: string | null) => {
    if (!statusId) return "";
    return getStatusColor(props.workflowStatuses || [], statusId);
  };
  const workflowStatuses = props.workflowStatuses || [];
  const doneStatusIds = props.doneStatusIds || new Set();
  const sprintMap: Record<string, string> = {};
  const {
    addSprintOpen, setAddSprintOpen,
    editSprintOpen, setEditSprintOpen,
    sprintTasksOpen, setSprintTasksOpen,
    selectedSprint, sprintName, setSprintName,
    sprintStartDate, setSprintStartDate, sprintEndDate, setSprintEndDate,
    sprintPhaseId, setSprintPhaseId, sprintTaskIds, setSprintTaskIds,
    editSprintId, setEditSprintId,
    editSprintName, setEditSprintName, editSprintStartDate, setEditSprintStartDate,
    editSprintEndDate, setEditSprintEndDate, editSprintStatus, setEditSprintStatus,
    editSprintPhaseId, setEditSprintPhaseId, editSprintTaskIds, setEditSprintTaskIds,
    createSprint, handleEditSprintSave, tasks, phases,
    PRIORITY_COLORS,
  } = props;

  return (
    <>
      <Dialog open={sprintTasksOpen} onOpenChange={setSprintTasksOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedSprint?.name} — Tasks</DialogTitle></DialogHeader>
          {(() => {
            const sprintTasks = (tasks || []).filter((t: any) => t.sprint_id === selectedSprint?.id);
            if (sprintTasks.length === 0) return <p className="text-sm text-muted-foreground py-4">No tasks assigned to this sprint.</p>;
            return (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sprintTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={statusColor(t.status_id) || ""}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                      {(t as any).users?.full_name && <Badge variant="secondary" className="text-xs">{(t as any).users?.full_name}</Badge>}
                      {t.estimated_hours && <Badge variant="secondary" className="text-xs">{t.estimated_hours}h</Badge>}
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Sprint Dialog */}
      <Dialog open={addSprintOpen} onOpenChange={(open) => { setAddSprintOpen(open); if (!open) { setSprintTaskIds([]); setSprintTaskSearch(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sprint</DialogTitle></DialogHeader>
          <form onSubmit={createSprint} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="e.g. Sprint 1" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase</label>
              <Select value={sprintPhaseId} onValueChange={setSprintPhaseId}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {(phases || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date *</label>
              <Input type="date" value={sprintStartDate} onChange={(e) => setSprintStartDate(e.target.value)} required max={sprintEndDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={sprintEndDate} onChange={(e) => setSprintEndDate(e.target.value)} required min={sprintStartDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tasks {sprintTaskIds.length > 0 && `(${sprintTaskIds.length} selected)`}</label>
              {sprintTaskIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {sprintTaskIds.map((tid) => {
                    const task = (tasks || []).find((t: any) => t.id === tid);
                    return task ? (
                      <Badge key={tid} variant="secondary" className="text-xs gap-1">
                        {task.title}
                        <button type="button" onClick={() => setSprintTaskIds((prev) => prev.filter((id) => id !== tid))} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-sm font-normal text-muted-foreground">
                    <Search className="mr-2 h-4 w-4 shrink-0" />
                    Select tasks...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
                  <Command>
                    <CommandInput placeholder="Search tasks..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No tasks found.</CommandEmpty>
                      <CommandGroup>
                        {(tasks || []).map((t: any) => {
                          const isSelected = sprintTaskIds.includes(t.id);
                          const isAssignedToSprint = !!t.sprint_id;
                          const isComplete = !!(t.status_id && doneStatusIds.has(t.status_id));
                          const disabled = isAssignedToSprint || isComplete;
                          return (
                            <CommandItem
                              key={t.id}
                              disabled={disabled}
                              onSelect={() => { if (!disabled) setSprintTaskIds((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]); }}
                              className="flex items-center gap-2"
                            >
                              <Checkbox checked={isSelected} disabled={disabled} className="pointer-events-none" />
                              <span className="flex-1 truncate font-medium">{t.title}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{t.users?.full_name || "Unassigned"}</Badge>
                              <Badge className={`text-[10px] shrink-0 ${statusColor(t.status_id) || ""}`}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                              {isAssignedToSprint && <span className="text-[10px] text-amber-600 shrink-0 whitespace-nowrap">In: {sprintMap[t.sprint_id] || "Sprint"}</span>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit" className="rounded-button w-full">Create Sprint</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sprint Dialog */}
      <Dialog open={editSprintOpen} onOpenChange={(open) => { if (!open) { setEditSprintOpen(false); setEditSprintId(null); setEditSprintTaskIds([]); setSprintTaskSearch(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Sprint</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSprintSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input value={editSprintName} onChange={(e) => setEditSprintName(e.target.value)} placeholder="Sprint name" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase *</label>
              <Select value={editSprintPhaseId} onValueChange={setEditSprintPhaseId}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {(phases || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date *</label>
              <Input type="date" value={editSprintStartDate} onChange={(e) => setEditSprintStartDate(e.target.value)} required max={editSprintEndDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={editSprintEndDate} onChange={(e) => setEditSprintEndDate(e.target.value)} required min={editSprintStartDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tasks {editSprintTaskIds.length > 0 && `(${editSprintTaskIds.length} selected)`}</label>
              {editSprintTaskIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {editSprintTaskIds.map((tid) => {
                    const task = (tasks || []).find((t: any) => t.id === tid);
                    return task ? (
                      <Badge key={tid} variant="secondary" className="text-xs gap-1">
                        {task.title}
                        <button type="button" onClick={() => setEditSprintTaskIds((prev) => prev.filter((id) => id !== tid))} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-sm font-normal text-muted-foreground">
                    <Search className="mr-2 h-4 w-4 shrink-0" />
                    Select tasks...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
                  <Command>
                    <CommandInput placeholder="Search tasks..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No tasks found.</CommandEmpty>
                      <CommandGroup>
                        {(tasks || []).map((t: any) => {
                          const isSelected = editSprintTaskIds.includes(t.id);
                          const isAssignedToOtherSprint = !!t.sprint_id && t.sprint_id !== editSprintId;
                          const isComplete = !!(t.status_id && doneStatusIds.has(t.status_id));
                          const disabled = isAssignedToOtherSprint || isComplete;
                          return (
                            <CommandItem
                              key={t.id}
                              disabled={disabled}
                              onSelect={() => { if (!disabled) setEditSprintTaskIds((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]); }}
                              className="flex items-center gap-2"
                            >
                              <Checkbox checked={isSelected} disabled={disabled} className="pointer-events-none" />
                              <span className="flex-1 truncate font-medium">{t.title}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{t.users?.full_name || "Unassigned"}</Badge>
                              <Badge className={`text-[10px] shrink-0 ${statusColor(t.status_id) || ""}`}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                              {isAssignedToOtherSprint && <span className="text-[10px] text-amber-600 shrink-0 whitespace-nowrap">In: {sprintMap[t.sprint_id] || "Sprint"}</span>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editSprintStatus} onValueChange={setEditSprintStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditSprintOpen(false); setEditSprintId(null); }}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
