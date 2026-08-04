import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, GripVertical, ArrowUpDown } from "lucide-react";
import { DataRow, TableHeader, RowPrimary, RowSecondary, RowDataItem, RowActions, editButtonClass } from "@/components/ui/data-row";
import { getCategoryColor } from "@/lib/workflow";

type Template = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type WorkflowStatus = {
  id: string;
  workflow_template_id: string;
  name: string;
  category: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
};

type WorkflowTransition = {
  id: string;
  workflow_template_id: string;
  from_status_id: string | null;
  to_status_id: string;
};

const CATEGORY_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const COLOR_OPTIONS = [
  { value: "bg-gray-100 text-gray-800", label: "Gray" },
  { value: "bg-blue-100 text-blue-800", label: "Blue" },
  { value: "bg-yellow-100 text-yellow-800", label: "Yellow" },
  { value: "bg-green-100 text-green-800", label: "Green" },
  { value: "bg-red-100 text-red-800", label: "Red" },
  { value: "bg-purple-100 text-purple-800", label: "Purple" },
  { value: "bg-pink-100 text-pink-800", label: "Pink" },
  { value: "bg-indigo-100 text-indigo-800", label: "Indigo" },
  { value: "bg-orange-100 text-orange-800", label: "Orange" },
  { value: "bg-teal-100 text-teal-800", label: "Teal" },
];

export default function WorkflowTemplatesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function invalidateWorkflowConsumers() {
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    queryClient.invalidateQueries({ queryKey: ["workflow-statuses"] });
    queryClient.invalidateQueries({ queryKey: ["workflow-transitions"] });
    queryClient.invalidateQueries({ queryKey: ["project-workflow"] });
    queryClient.invalidateQueries({ queryKey: ["project-workflow-transitions"] });
    queryClient.invalidateQueries({ queryKey: ["logsubmit-workflow"] });
  }

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusCategory, setStatusCategory] = useState("todo");
  const [statusColor, setStatusColor] = useState("bg-gray-100 text-gray-800");
  const [statusInitial, setStatusInitial] = useState(false);
  const [statusSortOrder, setStatusSortOrder] = useState("");

  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);
  const [confirmDelTemplateId, setConfirmDelTemplateId] = useState<string | null>(null);
  const [confirmDelStatusId, setConfirmDelStatusId] = useState<string | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [bulkDeleteTemplateOpen, setBulkDeleteTemplateOpen] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_templates").select("*").order("name");
      return (data || []) as Template[];
    },
  });

  const { data: statusesMap } = useQuery({
    queryKey: ["workflow-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_statuses").select("*").order("sort_order");
      const map: Record<string, WorkflowStatus[]> = {};
      (data || []).forEach((s) => {
        const ws = s as WorkflowStatus;
        if (!map[ws.workflow_template_id]) map[ws.workflow_template_id] = [];
        map[ws.workflow_template_id].push(ws);
      });
      return map;
    },
  });

  const { data: transitionsMap } = useQuery({
    queryKey: ["workflow-transitions"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_transitions").select("*");
      const map: Record<string, WorkflowTransition[]> = {};
      (data || []).forEach((t) => {
        const wt = t as WorkflowTransition;
        if (!map[wt.workflow_template_id]) map[wt.workflow_template_id] = [];
        map[wt.workflow_template_id].push(wt);
      });
      return map;
    },
  });

  const expandedStatuses = expandedId ? (statusesMap?.[expandedId] || []) : [];
  const expandedTransitions = expandedId ? (transitionsMap?.[expandedId] || []) : [];

  function openNewTemplate() {
    setEditTemplateId(null);
    setTemplateName("");
    setTemplateDesc("");
    setTemplateDialogOpen(true);
  }

  function openEditTemplate(t: Template) {
    setEditTemplateId(t.id);
    setTemplateName(t.name);
    setTemplateDesc(t.description || "");
    setTemplateDialogOpen(true);
  }

  async function saveTemplate() {
    if (!templateName.trim()) { toast.error("Name is required"); return; }
    const { error } = editTemplateId
      ? await supabase.from("workflow_templates").update({ name: templateName.trim(), description: templateDesc.trim() || null }).eq("id", editTemplateId)
      : await supabase.from("workflow_templates").insert({ name: templateName.trim(), description: templateDesc.trim() || null, created_by: profile?.id });
    if (error) {
      toast.error(`Could not save template: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    setTemplateDialogOpen(false);
    toast.success(editTemplateId ? "Template updated" : "Template created");
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from("workflow_templates").delete().eq("id", id);
    if (error) {
      toast.error(`Could not delete template: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    toast.success("Template deleted");
  }

  async function handleBulkDeleteTemplates() {
    const ids = Array.from(selectedTemplateIds);
    if (!ids.length) return;
    let failed = 0;
    for (const id of ids) {
      const { error } = await supabase.from("workflow_templates").delete().eq("id", id);
      if (error) failed++;
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    if (failed > 0) {
      toast.error(`${failed} template${failed > 1 ? "s" : ""} could not be deleted`);
    } else {
      toast.success(`${ids.length} template${ids.length > 1 ? "s" : ""} deleted`);
    }
    setSelectedTemplateIds(new Set());
    setBulkDeleteTemplateOpen(false);
  }

  function openNewStatus() {
    setEditStatusId(null);
    setStatusName("");
    setStatusCategory("todo");
    setStatusColor("bg-gray-100 text-gray-800");
    setStatusInitial(false);
    const maxOrder = expandedStatuses.reduce((max, s) => Math.max(max, s.sort_order), 0);
    setStatusSortOrder(String(maxOrder + 1));
    setStatusDialogOpen(true);
  }

  function openEditStatus(s: WorkflowStatus) {
    setEditStatusId(s.id);
    setStatusName(s.name);
    setStatusCategory(s.category);
    setStatusColor(s.color);
    setStatusInitial(s.is_initial);
    setStatusSortOrder(String(s.sort_order));
    setStatusDialogOpen(true);
  }

  async function saveStatus() {
    if (!statusName.trim() || !expandedId) { toast.error("Name is required"); return; }
    const targetOrder = parseInt(statusSortOrder, 10);
    if (isNaN(targetOrder) || targetOrder < 0) { toast.error("Sort order must be a non-negative number"); return; }

    const others = expandedStatuses.filter((s) => s.id !== editStatusId);
    const maxOrderAll = expandedStatuses.reduce((max, s) => Math.max(max, s.sort_order), 0);
    const tempOrder = maxOrderAll + 1;

    if (editStatusId) {
      const current = expandedStatuses.find((s) => s.id === editStatusId);
      const oldOrder = current ? current.sort_order : targetOrder;

      if (targetOrder !== oldOrder) {
        // Park the moved status out of the way first, so no unique-constraint collisions
        // occur while the other statuses shift.
        const { error: parkError } = await supabase
          .from("workflow_statuses")
          .update({ sort_order: tempOrder })
          .eq("id", editStatusId);
        if (parkError) {
          toast.error(`Could not save status: ${parkError.message}`);
          return;
        }

        if (targetOrder < oldOrder) {
          // Moving up: statuses between target and old shift down by 1 (descending to keep slots free)
          const toShift = others
            .filter((s) => s.sort_order >= targetOrder && s.sort_order < oldOrder)
            .sort((a, b) => b.sort_order - a.sort_order);
          for (const s of toShift) {
            const { error } = await supabase.from("workflow_statuses").update({ sort_order: s.sort_order + 1 }).eq("id", s.id);
            if (error) {
              toast.error(`Could not save status: ${error.message}`);
              return;
            }
          }
        } else {
          // Moving down: statuses between old and target shift up by 1 (ascending to keep slots free)
          const toShift = others
            .filter((s) => s.sort_order > oldOrder && s.sort_order <= targetOrder)
            .sort((a, b) => a.sort_order - b.sort_order);
          for (const s of toShift) {
            const { error } = await supabase.from("workflow_statuses").update({ sort_order: s.sort_order - 1 }).eq("id", s.id);
            if (error) {
              toast.error(`Could not save status: ${error.message}`);
              return;
            }
          }
        }
      }

      const { error: updateError } = await supabase.from("workflow_statuses").update({
        name: statusName.trim(),
        category: statusCategory,
        color: statusColor,
        is_initial: statusInitial,
        sort_order: targetOrder,
      }).eq("id", editStatusId);
      if (updateError) {
        toast.error(`Could not save status: ${updateError.message}`);
        return;
      }
    } else {
      // Adding: shift everything at target or later down by 1 (descending keeps slots free)
      const toShift = others
        .filter((s) => s.sort_order >= targetOrder)
        .sort((a, b) => b.sort_order - a.sort_order);
      for (const s of toShift) {
        const { error } = await supabase.from("workflow_statuses").update({ sort_order: s.sort_order + 1 }).eq("id", s.id);
        if (error) {
          toast.error(`Could not save status: ${error.message}`);
          return;
        }
      }
      const { error: insertError } = await supabase.from("workflow_statuses").insert({
        workflow_template_id: expandedId,
        name: statusName.trim(),
        category: statusCategory,
        color: statusColor,
        sort_order: targetOrder,
        is_initial: statusInitial,
      });
      if (insertError) {
        toast.error(`Could not create status: ${insertError.message}`);
        return;
      }
    }
    invalidateWorkflowConsumers();
    setStatusDialogOpen(false);
    toast.success(editStatusId ? "Status updated" : "Status created");
  }

  async function deleteStatus(id: string) {
    setDeletingStatusId(id);
    const { data: deletedRows, error: deleteError } = await supabase
      .from("workflow_statuses")
      .delete()
      .eq("id", id)
      .select();
    if (deleteError) {
      toast.error(`Could not delete status: ${deleteError.message}`);
      setDeletingStatusId(null);
      return;
    }
    if (!deletedRows || deletedRows.length === 0) {
      toast.error("Could not delete status. It may not exist, or you may not have permission to delete it.");
      setDeletingStatusId(null);
      return;
    }
    if (expandedId) {
      // Renumber remaining statuses to contiguous 0..n-1 to close any gaps
      const remaining = expandedStatuses
        .filter((s) => s.id !== id)
        .sort((a, b) => a.sort_order - b.sort_order);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].sort_order !== i) {
          const { error: renumberError } = await supabase
            .from("workflow_statuses")
            .update({ sort_order: i })
            .eq("id", remaining[i].id);
          if (renumberError) {
            toast.error(`Status deleted, but renumbering failed: ${renumberError.message}`);
            break;
          }
        }
      }
    }
    invalidateWorkflowConsumers();
    setDeletingStatusId(null);
    toast.success("Status deleted");
  }

  async function toggleTransition(fromId: string, toId: string) {
    if (!expandedId) return;
    const existing = expandedTransitions.find((t) => t.from_status_id === fromId && t.to_status_id === toId);
    if (existing) {
      const { error } = await supabase.from("workflow_transitions").delete().eq("id", existing.id);
      if (error) {
        toast.error(`Could not remove transition: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("workflow_transitions").insert({
        workflow_template_id: expandedId,
        from_status_id: fromId,
        to_status_id: toId,
      });
      if (error) {
        toast.error(`Could not add transition: ${error.message}`);
        return;
      }
    }
    invalidateWorkflowConsumers();
  }

  const gridCols = "40px 1fr 192px 80px";
  const gridColsStatus = "1fr 112px 96px 80px 80px";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workflow Templates</h1>
        <Button onClick={openNewTemplate}><Plus className="h-4 w-4 mr-2" />New Template</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : (
        <Card>
          <TableHeader gridCols={gridCols}>
            <div className="flex items-center justify-center">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                checked={selectedTemplateIds.size === (templates || []).length && (templates || []).length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedTemplateIds(new Set((templates || []).map((t) => t.id)));
                  else setSelectedTemplateIds(new Set());
                }} />
            </div>
            <RowDataItem label="Name" />
            <RowDataItem label="Created" />
            <RowDataItem label="" />
          </TableHeader>
          <div>
            {selectedTemplateIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                <span className="text-sm text-blue-700">{selectedTemplateIds.size} template{selectedTemplateIds.size > 1 ? "s" : ""} selected</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedTemplateIds(new Set())} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white">Clear selection</button>
                  <button onClick={() => setBulkDeleteTemplateOpen(true)} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete selected
                  </button>
                </div>
              </div>
            )}
            {(templates || []).map((t) => (
              <div key={t.id}>
                <DataRow
                  gridCols={gridCols}
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  <div className="flex items-center justify-center">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                      checked={selectedTemplateIds.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(selectedTemplateIds);
                        if (e.target.checked) next.add(t.id); else next.delete(t.id);
                        setSelectedTemplateIds(next);
                      }}
                      onClick={(e) => e.stopPropagation()} />
                  </div>
                  <div>
                    <RowPrimary>{t.name}</RowPrimary>
                    {t.description && <RowSecondary>{t.description}</RowSecondary>}
                  </div>
                  <RowDataItem label="Created">{new Date(t.created_at).toLocaleDateString()}</RowDataItem>
                  <RowActions>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditTemplate(t); }}
                      className={editButtonClass}
                      title="Edit template"
                    ><Pencil className="h-3.5 w-3.5" /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelTemplateId(t.id); }}
                      className="shrink-0 p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                      title="Delete template"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  </RowActions>
                </DataRow>

                {expandedId === t.id && (
                  <div className="bg-gray-50 px-6 py-4 border-t border-b space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-gray-500">Statuses</h3>
                      <Button size="sm" variant="outline" onClick={openNewStatus}><Plus className="h-3.5 w-3.5 mr-1" />Add Status</Button>
                    </div>

                    <TableHeader gridCols={gridColsStatus}>
                      <RowDataItem label="Status" />
                      <RowDataItem label="Category" />
                      <RowDataItem label="Initial" />
                      <RowDataItem label="Sort" />
                      <RowDataItem label="" />
                    </TableHeader>
                    <div>
                      {expandedStatuses.map((s) => (
                        <DataRow key={s.id} gridCols={gridColsStatus}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.name}</span>
                          </div>
                          <RowDataItem label="Category">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(s.category)}`}>
                              {s.category.replace(/_/g, " ")}
                            </span>
                          </RowDataItem>
                          <RowDataItem label="Initial">{s.is_initial ? <span className="text-green-600 font-bold">Yes</span> : "—"}</RowDataItem>
                          <RowDataItem label="Sort">{s.sort_order}</RowDataItem>
                          <RowActions>
                            <button onClick={() => openEditStatus(s)} className={editButtonClass} title="Edit status"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setConfirmDelStatusId(s.id)} disabled={deletingStatusId === s.id} className="shrink-0 p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50" title="Delete status"><Trash2 className="h-3.5 w-3.5" /></button>
                          </RowActions>
                        </DataRow>
                      ))}
                    </div>

                    {expandedStatuses.length > 1 && (
                      <>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-gray-500 pt-2">Transitions</h3>
                        <p className="text-xs text-gray-400">Check a cell to allow a transition from the row status to the column status.</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="p-2 border text-left font-medium text-gray-500">From \ To</th>
                                {expandedStatuses.map((s) => (
                                  <th key={s.id} className="p-2 border text-center font-medium">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${s.color}`}>{s.name}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {expandedStatuses.map((from) => (
                                <tr key={from.id}>
                                  <td className="p-2 border font-medium break-words">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${from.color}`}>{from.name}</span>
                                  </td>
                                  {expandedStatuses.map((to) => {
                                    const hasTransition = expandedTransitions.some(
                                      (tr) => tr.from_status_id === from.id && tr.to_status_id === to.id
                                    );
                                    return (
                                      <td key={to.id} className="p-2 border text-center break-words">
                                        {from.id === to.id ? (
                                          <span className="text-gray-300">—</span>
                                        ) : (
                                          <input
                                            type="checkbox"
                                            checked={hasTransition}
                                            onChange={() => toggleTransition(from.id, to.id)}
                                            className="h-4 w-4 cursor-pointer accent-blue-600"
                                          />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTemplateId ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Standard" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTemplate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editStatusId ? "Edit Status" : "New Status"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="e.g. in_review" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={statusCategory} onValueChange={setStatusCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <Select value={statusColor} onValueChange={setStatusColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${o.value.split(" ")[0]}`} />
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${statusColor}`}>Preview</span>
              </div>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                min={0}
                value={statusSortOrder}
                onChange={(e) => setStatusSortOrder(e.target.value)}
                placeholder="e.g. 0"
              />
              {(() => {
                const parsed = parseInt(statusSortOrder, 10);
                const takenBy = !isNaN(parsed) && parsed >= 0
                  ? expandedStatuses.find((s) => s.id !== editStatusId && s.sort_order === parsed)
                  : undefined;
                if (takenBy) {
                  return (
                    <p className="text-xs text-amber-600 mt-1">
                      Sort {parsed} is taken by "{takenBy.name}". It will shift down by 1 to make room
                      {!editStatusId && " (along with every status after it)"}.
                    </p>
                  );
                }
                return <p className="text-xs text-muted-foreground mt-1">Determines the column order on the kanban board. Defaults to the next available number.</p>;
              })()}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={statusInitial} onChange={(e) => setStatusInitial(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              <Label className="cursor-pointer">Initial status (default for new tasks)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveStatus}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!confirmDelTemplateId} onOpenChange={(open) => !open && setConfirmDelTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this template and all its statuses and transitions. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelTemplateId) deleteTemplate(confirmDelTemplateId); setConfirmDelTemplateId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Status Confirmation */}
      <AlertDialog open={!!confirmDelStatusId} onOpenChange={(open) => !open && setConfirmDelStatusId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete status?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this status and all its transitions. Tasks using this status may need to be updated.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelStatusId) deleteStatus(confirmDelStatusId); setConfirmDelStatusId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Templates Confirmation */}
      <AlertDialog open={bulkDeleteTemplateOpen} onOpenChange={setBulkDeleteTemplateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTemplateIds.size} Template{selectedTemplateIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete these templates and all their statuses and transitions. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteTemplates} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
