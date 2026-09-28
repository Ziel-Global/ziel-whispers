import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
  tasks?: any[];
  sprintTaskCount?: Record<string, number>;
}

function formatSprintStatus(status: string | undefined) {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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
  tasks = [],
  sprintTaskCount,
}: ProjectPhasesTabProps) {
  const navigate = useNavigate();
  const [confirmPhaseDelId, setConfirmPhaseDelId] = useState<string | null>(null);
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);

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

  const taskCountForSprint = (sprintId: string) => {
    if (sprintTaskCount && sprintTaskCount[sprintId] != null) return sprintTaskCount[sprintId];
    return (tasks || []).filter((t: any) => t.sprint_id === sprintId).length;
  };

  if (isAdmin) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
          <div className="text-[18px] font-bold text-[#17171A]">Phases</div>
          <button
            type="button"
            onClick={() => setAddPhaseOpen(true)}
            className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Add Phase
          </button>
        </div>

        {phases.length === 0 ? (
          <p className="text-[13px] text-[#8B8B92] py-8 text-center">No phases yet.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {phases.map((p: any) => {
              const sprintCount = (sprints || []).filter((s: any) => s.phase_id === p.id).length;
              const pct = Math.round(phaseProgress[p.id] || 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPhaseTasks(p)}
                  className="bg-white border border-black/[0.08] rounded-[14px] p-5 text-left min-w-0 hover:border-[#EB5A1E]/35 transition-colors relative group"
                >
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${slug}/phases/${p.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          navigate(`/projects/${slug}/phases/${p.id}`);
                        }
                      }}
                      className="w-[26px] h-[26px] rounded-lg bg-[#FDECE3] flex items-center justify-center"
                      title="Edit Phase"
                    >
                      <Pencil className="h-3 w-3 text-[#EB5A1E]" strokeWidth={2} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmPhaseDelId(p.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          setConfirmPhaseDelId(p.id);
                        }
                      }}
                      className="w-[26px] h-[26px] rounded-lg bg-[#FDECEC] flex items-center justify-center"
                      title="Delete Phase"
                    >
                      <Trash2 className="h-3 w-3 text-[#E5484D]" strokeWidth={2} />
                    </span>
                  </div>
                  <div className="text-[15px] font-bold text-[#17171A] mb-1.5 pr-14 truncate">{p.title}</div>
                  <div className="text-[12.5px] text-[#8B8B92] mb-3.5">
                    {sprintCount} sprint{sprintCount === 1 ? "" : "s"}
                  </div>
                  <div className="h-1.5 rounded bg-[#F3E9E3] overflow-hidden mb-2">
                    <div
                      className="h-full rounded bg-[#EB5A1E] transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#4B4B52] font-semibold">{pct}% complete</div>
                </button>
              );
            })}
          </div>
        )}

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="client-section-title mb-0">Phases</h3>
      </div>
      {phases.length === 0 ? (
        <div className="client-empty-state">
          <div className="text-[12px] font-semibold text-[#3F3F45] mb-1">No phases yet</div>
          <p className="text-[9.5px] max-w-[360px] mx-auto leading-relaxed">
            Phase progress will appear here once phases are set up.
          </p>
        </div>
      ) : (
        <div className="client-table-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="bg-[#F8F8FA] border-b border-[#E2E2E5]">
                  <th className="w-[62%] px-3.5 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                    Phase
                  </th>
                  <th className="px-3.5 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                    Due Date
                  </th>
                  <th className="px-3.5 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                    Progress
                  </th>
                  <th className="w-[70px] px-3.5 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {phases.map((p: any) => {
                  const phaseSprints = (sprints || []).filter((s: any) => s.phase_id === p.id);
                  const expanded = expandedPhaseId === p.id;
                  const pct = phaseProgress[p.id] || 0;
                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className="border-b border-[#EFEFF1] hover:bg-[#FAFAFB] cursor-pointer transition-colors"
                        onClick={() => setExpandedPhaseId(expanded ? null : p.id)}
                      >
                        <td className="px-3.5 py-[13px] align-middle">
                          <div className="text-[10.5px] font-semibold text-[#202024] leading-[1.45]">{p.title}</div>
                          <div className="text-[8.3px] text-[#96969D] mt-0.5">
                            {phaseSprints.length} sprint{phaseSprints.length !== 1 ? "s" : ""}
                          </div>
                        </td>
                        <td className="px-3.5 py-[13px] align-middle text-[9.5px] text-[#4C4C53]">
                          {p.due_date ? format(new Date(p.due_date + "T00:00:00"), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-3.5 py-[13px] align-middle">
                          <div className="flex items-center gap-2">
                            <div className="w-[72px] h-[7px] rounded-full bg-[#F0F0F2] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#EB5A1E] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[9.5px] text-[#4C4C53]">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-[13px] align-middle text-[#A0A0A6] text-[12px]">
                          <span
                            className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}
                            aria-hidden
                          >
                            ⌄
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-[#FBFBFC] border-b border-[#EFEFF1]">
                          <td colSpan={4} className="px-4 py-[13px]">
                            {phaseSprints.length === 0 ? (
                              <p className="text-[9.5px] text-[#96969D] m-0">No sprints in this phase.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {phaseSprints.map((s: any) => {
                                  const n = taskCountForSprint(s.id);
                                  const dates =
                                    s.start_date && s.end_date
                                      ? `${format(new Date(s.start_date + "T00:00:00"), "MMM d")} – ${format(new Date(s.end_date + "T00:00:00"), "MMM d")}`
                                      : "—";
                                  return (
                                    <span
                                      key={s.id}
                                      className="inline-flex items-center gap-1.5 mr-1 px-2.5 py-1.5 border border-[#E4E4E7] bg-white rounded-lg text-[9.5px] text-[#4C4C53]"
                                    >
                                      <i className="w-1.5 h-1.5 rounded-full bg-[#4C8DF5] flex-none not-italic" />
                                      <b className="font-semibold text-[#17171A]">{s.name}</b>
                                      <span>{dates}</span>
                                      <span>
                                        {n} task{n !== 1 ? "s" : ""}
                                      </span>
                                      <span>{formatSprintStatus(s.status)}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
