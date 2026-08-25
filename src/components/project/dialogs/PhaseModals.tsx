import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { format } from "date-fns";

export interface PhaseModalsProps {
  addPhaseOpen: boolean; setAddPhaseOpen: (open: boolean) => void;
  phaseTasksOpen: boolean; setPhaseTasksOpen: (open: boolean) => void;
  selectedPhase: any;
  phaseTitle: string; setPhaseTitle: (v: string) => void;
phaseDueDate: string;
  setPhaseDueDate: (v: string) => void;
handleCreatePhase: (e: React.FormEvent) => void;
  tasks: any[];
  sprints: any[];
  openEditTask: (task: any) => void;
  setViewTaskData: (task: any) => void;
  PRIORITY_COLORS: Record<string, string>;
  doneStatusIds?: Set<string>;
}

export function PhaseModals(props: PhaseModalsProps) {
  const {
    addPhaseOpen, setAddPhaseOpen,
    phaseTasksOpen, setPhaseTasksOpen,
    selectedPhase, phaseTitle, setPhaseTitle,
    phaseDueDate, setPhaseDueDate,
    handleCreatePhase,
    tasks, sprints, openEditTask, setViewTaskData, PRIORITY_COLORS, doneStatusIds
  } = props;

  const { sprintProgress, sprintTaskCount } = React.useMemo(() => {
    const progressMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};
    const doneSet = doneStatusIds || new Set();

    (sprints || []).forEach((s: any) => {
      const sTasks = (tasks || []).filter((t: any) => t.sprint_id === s.id);
      countMap[s.id] = sTasks.length;
      if (sTasks.length === 0) {
        progressMap[s.id] = 0;
      } else {
        const completed = sTasks.filter((t: any) => t.status_id && doneSet.has(t.status_id)).length;
        progressMap[s.id] = Math.round((completed / sTasks.length) * 100);
      }
    });

    return { sprintProgress: progressMap, sprintTaskCount: countMap };
  }, [sprints, tasks, doneStatusIds]);

  return (
    <>
      <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Phase</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePhase} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase Title *</label>
              <Input value={phaseTitle} onChange={(e) => setPhaseTitle(e.target.value)} placeholder="e.g. Alpha" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" value={phaseDueDate} onChange={(e) => setPhaseDueDate(e.target.value)} />
            </div>
            <Button type="submit" className="rounded-button w-full">Create Phase</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Phase Tasks Dialog */}
      <Dialog open={phaseTasksOpen} onOpenChange={setPhaseTasksOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedPhase?.title}</DialogTitle></DialogHeader>
          <Tabs defaultValue="sprints">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="sprints">Sprints</TabsTrigger>
            </TabsList>
            <TabsContent value="sprints" className="space-y-2 max-h-80 overflow-y-auto">
              {(() => {
                const phaseSprints = (sprints || []).filter((s: any) => s.phase_id === selectedPhase?.id);
                if (phaseSprints.length === 0) return <p className="text-sm text-muted-foreground py-4">No sprints in this phase.</p>;
                return phaseSprints.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${sprintProgress[s.id] || 0}%` }} />
                        </div>
                        <span className="text-[10px] text-[#6b7280]">{sprintProgress[s.id] || 0}%</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}</Badge>
                      <Badge className={
                        s.status === "active" ? "bg-green-100 text-green-800" :
                        s.status === "completed" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-800"
                      }>{s.status}</Badge>
                      <Badge variant="secondary" className="text-xs">{sprintTaskCount[s.id] || 0} tasks</Badge>
                    </div>
                  </div>
                ));
              })()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
