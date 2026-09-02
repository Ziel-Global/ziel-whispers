import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

interface ProjectPhasesTabProps {
  id: string;
  slug: string | undefined;
  phases: any[];
  sprints: any[];
  phaseProgress: Record<string, number>;
  isAdmin: boolean;
  setAddPhaseOpen: (open: boolean) => void;
  openPhaseTasks: (phase: any) => void;
  queryClient: any;
}

export function ProjectPhasesTab({
  id,
  slug,
  phases,
  sprints,
  phaseProgress,
  isAdmin,
  setAddPhaseOpen,
  openPhaseTasks,
  queryClient,
}: ProjectPhasesTabProps) {
  const navigate = useNavigate();
  const [confirmPhaseDelId, setConfirmPhaseDelId] = useState<string | null>(null);

  const deletePhase = async (phaseId: string) => {
    if (!id) return;
    const { error } = await supabase.from("project_phases").delete().eq("id", phaseId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Phase deleted");
    setConfirmPhaseDelId(null);
    queryClient.invalidateQueries({ queryKey: ["project-phases", id] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Phases</h3>
        {isAdmin && (
          <Button
            size="sm"
            className="rounded-button bg-primary text-black hover:bg-black hover:text-white active:bg-black"
            onClick={() => setAddPhaseOpen(true)}
          >
            Add Phase
          </Button>
        )}
      </div>
      {phases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No phases yet.</p>
      ) : (
        <div>
          <TableHeader gridCols="1fr 112px 192px 80px">
            <span>PHASE</span>
            <span>DUE DATE</span>
            <span>PROGRESS</span>
            <span className="text-right">ACTIONS</span>
          </TableHeader>
          {phases.map((p: any) => (
            <DataRow key={p.id} onClick={() => openPhaseTasks(p)} gridCols="1fr 112px 192px 80px">
              <div>
                <RowPrimary className="whitespace-normal break-words">{p.title}</RowPrimary>
                <RowSecondary>{(sprints || []).filter((s: any) => s.phase_id === p.id).length} sprints</RowSecondary>
              </div>
              <RowDataItem label="DUE DATE">{p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}</RowDataItem>
              <RowDataItem label="PROGRESS">
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${phaseProgress[p.id]}%` }} />
                  </div>
                  <span className="text-[11px] text-[#6b7280]">{phaseProgress[p.id]}%</span>
                </div>
              </RowDataItem>
              <RowActions className="justify-self-end">
                {isAdmin && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${slug}/phases/${p.id}`);
                      }}
                      className={editButtonClass}
                      title="Edit Phase"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmPhaseDelId(p.id);
                      }}
                      className={editButtonClass}
                      title="Delete Phase"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </>
                )}
              </RowActions>
            </DataRow>
          ))}
        </div>
      )}

      {/* Delete Phase Confirmation Dialog */}
      <AlertDialog open={!!confirmPhaseDelId} onOpenChange={(open) => !open && setConfirmPhaseDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phase?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this phase? Sprints and tasks in this phase will remain but may need to be updated. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPhaseDelId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmPhaseDelId) deletePhase(confirmPhaseDelId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Phase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
