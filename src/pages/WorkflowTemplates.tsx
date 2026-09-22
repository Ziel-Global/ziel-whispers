import { useEffect, useMemo, useRef, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Download, GitBranch, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { DataRow, TableHeader, RowPrimary, RowSecondary, RowDataItem, RowActions, editButtonClass } from "@/components/ui/data-row";
import { getCategoryColor } from "@/lib/workflow";
import { exportWorkflowPdf } from "@/lib/exportWorkflowPdf";
import { WorkflowPathPreview } from "@/components/workflow/WorkflowPathPreview";

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
  /** B2-A */
  retired: boolean;
};

type WorkflowTransition = {
  id: string;
  workflow_template_id: string;
  from_status_id: string | null;
  to_status_id: string;
  allowed_role_ids?: string[] | null;
};

const CATEGORY_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const COLOR_OPTIONS = [
  { value: "bg-gray-100 text-gray-800", label: "Gray", dot: "#6b7280" },
  { value: "bg-blue-100 text-blue-800", label: "Blue", dot: "#5f7ee2" },
  { value: "bg-yellow-100 text-yellow-800", label: "Yellow", dot: "#d4a017" },
  { value: "bg-green-100 text-green-800", label: "Green", dot: "#4cab74" },
  { value: "bg-red-100 text-red-800", label: "Red", dot: "#d96a6a" },
  { value: "bg-purple-100 text-purple-800", label: "Purple", dot: "#9b6ac8" },
  { value: "bg-pink-100 text-pink-800", label: "Pink", dot: "#db5a8c" },
  { value: "bg-indigo-100 text-indigo-800", label: "Indigo", dot: "#4f46e5" },
  { value: "bg-orange-100 text-orange-800", label: "Orange", dot: "#f47a2a" },
  { value: "bg-teal-100 text-teal-800", label: "Teal", dot: "#1aa39a" },
];

const DOT_HEX_BY_BG: Record<string, string> = {
  "bg-gray-100": "#6b7280",
  "bg-gray-500": "#6b7280",
  "bg-blue-100": "#5f7ee2",
  "bg-blue-500": "#5f7ee2",
  "bg-yellow-100": "#d4a017",
  "bg-yellow-500": "#d4a017",
  "bg-green-100": "#4cab74",
  "bg-green-500": "#4cab74",
  "bg-red-100": "#d96a6a",
  "bg-red-500": "#d96a6a",
  "bg-purple-100": "#9b6ac8",
  "bg-purple-500": "#9b6ac8",
  "bg-pink-100": "#db5a8c",
  "bg-pink-500": "#db5a8c",
  "bg-indigo-100": "#4f46e5",
  "bg-indigo-500": "#4f46e5",
  "bg-orange-100": "#f47a2a",
  "bg-orange-500": "#f47a2a",
  "bg-teal-100": "#1aa39a",
  "bg-teal-500": "#1aa39a",
};

function statusDotHex(color: string) {
  const match = COLOR_OPTIONS.find((c) => c.value === color);
  if (match) return match.dot;
  const bg = (color || "").split(" ")[0];
  return DOT_HEX_BY_BG[bg] || "#6b7280";
}

function normalizeStatusColor(color: string) {
  if (COLOR_OPTIONS.some((c) => c.value === color)) return color;
  const hex = statusDotHex(color);
  return COLOR_OPTIONS.find((c) => c.dot === hex)?.value || COLOR_OPTIONS[0].value;
}

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
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusCategory, setStatusCategory] = useState("todo");
  const [statusColor, setStatusColor] = useState("bg-gray-100 text-gray-800");
  const [statusInitial, setStatusInitial] = useState(false);
  const [statusRetired, setStatusRetired] = useState(false);
  const [statusSortOrder, setStatusSortOrder] = useState("");

  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);
  const [confirmDelTemplateId, setConfirmDelTemplateId] = useState<string | null>(null);
  const [confirmDelStatusId, setConfirmDelStatusId] = useState<string | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [bulkDeleteTemplateOpen, setBulkDeleteTemplateOpen] = useState(false);
  const [localOrderIds, setLocalOrderIds] = useState<string[] | null>(null);
  const [draggingStatusId, setDraggingStatusId] = useState<string | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const dragFromHandleRef = useRef(false);
  const dragOrderRef = useRef<string[] | null>(null);
  const pathSvgRef = useRef<SVGSVGElement | null>(null);

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

  const displayStatuses = useMemo(() => {
    if (!localOrderIds) return expandedStatuses;
    const byId = new Map(expandedStatuses.map((s) => [s.id, s]));
    const ordered: WorkflowStatus[] = [];
    localOrderIds.forEach((id) => {
      const status = byId.get(id);
      if (status) ordered.push(status);
    });
    expandedStatuses.forEach((s) => {
      if (!localOrderIds.includes(s.id)) ordered.push(s);
    });
    return ordered.map((s, i) => ({ ...s, sort_order: i }));
  }, [expandedStatuses, localOrderIds]);

  useEffect(() => {
    setLocalOrderIds(null);
    setDraggingStatusId(null);
    setDragOverStatusId(null);
  }, [expandedId]);

  useEffect(() => {
    if (!localOrderIds) return;
    const serverIds = expandedStatuses.map((s) => s.id);
    if (serverIds.join() === localOrderIds.join()) setLocalOrderIds(null);
  }, [expandedStatuses, localOrderIds]);

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
    setSavingTemplate(true);
    try {
    if (editTemplateId) {
      const { error } = await supabase
        .from("workflow_templates")
        .update({ name: templateName.trim(), description: templateDesc.trim() || null })
        .eq("id", editTemplateId);
      if (error) {
        toast.error(`Could not save template: ${error.message}`);
        return;
      }
    } else {
      const { data: newT, error } = await supabase
        .from("workflow_templates")
        .insert({ name: templateName.trim(), description: templateDesc.trim() || null, created_by: profile?.id })
        .select("id")
        .single();
      if (error) {
        toast.error(`Could not create template: ${error.message}`);
        return;
      }
      if (newT?.id) {
        // Auto-seed Backlog status as initial status
        await supabase.from("workflow_statuses").insert({
          workflow_template_id: newT.id,
          name: "Backlog",
          category: "todo",
          color: "bg-gray-100 text-gray-800",
          sort_order: 0,
          is_initial: true,
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    queryClient.invalidateQueries({ queryKey: ["workflow-statuses"] });
    setTemplateDialogOpen(false);
    toast.success(editTemplateId ? "Template updated" : "Template created");
    } finally {
      setSavingTemplate(false);
    }
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
    setStatusRetired(false);
    setStatusSortOrder(String(displayStatuses.length + 1));
    setStatusDialogOpen(true);
  }

  function openEditStatus(s: WorkflowStatus) {
    setEditStatusId(s.id);
    setStatusName(s.name);
    setStatusCategory(s.category);
    setStatusColor(normalizeStatusColor(s.color));
    setStatusInitial(s.is_initial);
    setStatusRetired(s.retired ?? false);
    const visibleIndex = displayStatuses.findIndex((row) => row.id === s.id);
    setStatusSortOrder(String(visibleIndex >= 0 ? visibleIndex + 1 : displayStatuses.length));
    setStatusDialogOpen(true);
  }

  async function saveStatus() {
    if (!statusName.trim() || !expandedId) { toast.error("Name is required"); return; }
    const parsed = parseInt(statusSortOrder, 10);
    if (isNaN(parsed)) { toast.error("Order must be a number"); return; }

    setSavingStatus(true);
    try {
    if (editStatusId) {
      const n = displayStatuses.length;
      const position = Math.min(n, Math.max(1, parsed));
      const { error: updateError } = await supabase.from("workflow_statuses").update({
        name: statusName.trim(),
        category: statusCategory,
        color: statusColor,
        is_initial: statusInitial,
        retired: statusRetired,
      } as any).eq("id", editStatusId);
      if (updateError) {
        toast.error(`Could not save status: ${updateError.message}`);
        return;
      }
      const ids = displayStatuses.map((s) => s.id).filter((id) => id !== editStatusId);
      ids.splice(position - 1, 0, editStatusId);
      await persistStatusOrder(ids);
    } else {
      const n = displayStatuses.length;
      const position = Math.min(n + 1, Math.max(1, parsed));
      const maxOrder = expandedStatuses.reduce((max, s) => Math.max(max, s.sort_order), 0);
      const { data: created, error: insertError } = await supabase.from("workflow_statuses").insert({
        workflow_template_id: expandedId,
        name: statusName.trim(),
        category: statusCategory,
        color: statusColor,
        sort_order: maxOrder + 100,
        is_initial: statusInitial,
        retired: false,
      } as any).select("id").single();
      if (insertError || !created?.id) {
        toast.error(`Could not create status: ${insertError?.message || "Unknown error"}`);
        return;
      }
      const ids = displayStatuses.map((s) => s.id);
      ids.splice(position - 1, 0, created.id);
      await persistStatusOrder(ids);
    }
    invalidateWorkflowConsumers();
    setStatusDialogOpen(false);
    toast.success(editStatusId ? "Status updated" : "Status created");
    } finally {
      setSavingStatus(false);
    }
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
        // new transitions default to unrestricted
        allowed_role_ids: null,
      } as any);
      if (error) {
        toast.error(`Could not add transition: ${error.message}`);
        return;
      }
    }
    invalidateWorkflowConsumers();
  }

  function currentStatusIds() {
    return displayStatuses.map((s) => s.id);
  }

  function moveStatusId(ids: string[], fromId: string, toId: string, after: boolean) {
    if (fromId === toId) return ids;
    const next = ids.filter((id) => id !== fromId);
    const toIndex = next.indexOf(toId);
    if (toIndex === -1) return ids;
    next.splice(after ? toIndex + 1 : toIndex, 0, fromId);
    return next;
  }

  async function persistStatusOrder(ids: string[]) {
    if (!expandedId || !ids.length) return;
    const maxOrder = expandedStatuses.reduce((max, s) => Math.max(max, s.sort_order), 0);
    const parkBase = maxOrder + ids.length + 100;
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from("workflow_statuses")
        .update({ sort_order: parkBase + i })
        .eq("id", ids[i]);
      if (error) {
        toast.error(`Could not reorder statuses: ${error.message}`);
        invalidateWorkflowConsumers();
        return;
      }
    }
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from("workflow_statuses")
        .update({ sort_order: i })
        .eq("id", ids[i]);
      if (error) {
        toast.error(`Could not reorder statuses: ${error.message}`);
        invalidateWorkflowConsumers();
        return;
      }
    }
    invalidateWorkflowConsumers();
  }

  const gridCols = "40px 1fr 192px 80px";
  const selectedTemplate = templates?.find(t => t.id === expandedId);

  async function downloadWorkflowPdf() {
    if (!selectedTemplate || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportWorkflowPdf({
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        statuses: displayStatuses,
        transitions: expandedTransitions,
        svg: pathSvgRef.current,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download workflow PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  async function saveChanges() {
    if (!selectedTemplate || savingChanges) return;
    setSavingChanges(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["workflow-templates"] }),
        queryClient.refetchQueries({ queryKey: ["workflow-statuses"] }),
        queryClient.refetchQueries({ queryKey: ["workflow-transitions"] }),
      ]);
      toast.success("Changes saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSavingChanges(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workflow Templates</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage reusable workflow templates with a cleaner, builder-focused layout.</p>
          </div>
          <Button
            onClick={openNewTemplate}
            className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 text-white" />
            New Template
          </Button>
        </div>
        
        {templates && templates.length > 0 && (
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <Select value={expandedId || ""} onValueChange={setExpandedId}>
                    <TooltipTrigger asChild>
                      <SelectTrigger
                        className="w-[300px] min-w-0 max-w-full overflow-hidden bg-white border-gray-200 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-left [&>svg]:shrink-0"
                      >
                        <SelectValue placeholder="Choose which workflow you want to edit" />
                      </SelectTrigger>
                    </TooltipTrigger>
                    <SelectContent className="w-[300px]">
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id} title={t.name}>
                          <div className="flex min-w-0 max-w-[220px] items-center gap-2">
                            <div className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                            <span className="truncate">{t.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TooltipContent side="bottom" align="start" className="max-w-sm">
                    {selectedTemplate?.name || "Choose which workflow you want to edit"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="text-xs text-gray-400 shrink-0">Choose which workflow you want to edit</div>
            </div>
            {selectedTemplate && (
              <button
                type="button"
                title="Download workflow PDF"
                aria-label="Download workflow PDF"
                disabled={exportingPdf}
                onClick={downloadWorkflowPdf}
                className="inline-grid h-[38px] w-[38px] min-w-[38px] shrink-0 place-items-center rounded-[10px] border border-[#e7e9ee] bg-white text-[#687282] transition duration-150 hover:-translate-y-px hover:border-[#d8dde5] hover:bg-[#f8f9fb] hover:text-[#1f232b] disabled:pointer-events-none disabled:opacity-60"
              >
                {exportingPdf ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : <Download className="h-[17px] w-[17px]" strokeWidth={1.8} />}
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-32 w-full" /></div>
      ) : selectedTemplate ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h2>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span>Workflow template</span>
                <span>â€¢</span>
                <span>Updated {new Date(selectedTemplate.created_at).toLocaleDateString()}</span>
                <span>â€¢</span>
                <span>{displayStatuses.length} statuses</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditTemplate(selectedTemplate)}>Rename</Button>
              <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirmDelTemplateId(selectedTemplate.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Flowchart Section */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">Workflow Path</h3>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Live preview
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Keep the default path easy to follow. You can change the order anytime.</p>
              </div>
              <Button variant="outline" size="sm" onClick={openNewStatus}>Add Status</Button>
            </div>
            
            <WorkflowPathPreview
              statuses={displayStatuses}
              transitions={expandedTransitions}
              svgRef={pathSvgRef}
            />
          </div>

          {/* Statuses Table Section */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col mb-4">
              <h3 className="font-semibold text-gray-900 mb-0.5">Statuses</h3>
              <p className="text-xs text-gray-500">Manage the workflow statuses in one simple list.</p>
            </div>
            
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="grid grid-cols-[30px_1fr_120px_80px_60px_100px] gap-4 p-3 bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider items-center">
                <div></div>
                <div>Status</div>
                <div>System State</div>
                <div>Initial</div>
                <div>Order</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-gray-100">
                {displayStatuses.map((s, index) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => {
                      if (!dragFromHandleRef.current) {
                        e.preventDefault();
                        return;
                      }
                      setDraggingStatusId(s.id);
                      const ids = currentStatusIds();
                      dragOrderRef.current = ids;
                      setLocalOrderIds(ids);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", s.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!draggingStatusId || draggingStatusId === s.id) return;
                      setDragOverStatusId(s.id);
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const after = e.clientY > rect.top + rect.height / 2;
                      const next = moveStatusId(currentStatusIds(), draggingStatusId, s.id, after);
                      dragOrderRef.current = next;
                      setLocalOrderIds(next);
                    }}
                    onDragLeave={() => {
                      if (dragOverStatusId === s.id) setDragOverStatusId(null);
                    }}
                    onDragEnd={async () => {
                      dragFromHandleRef.current = false;
                      setDraggingStatusId(null);
                      setDragOverStatusId(null);
                      const next = dragOrderRef.current;
                      const original = expandedStatuses.map((st) => st.id);
                      if (next && next.join() !== original.join()) {
                        await persistStatusOrder(next);
                      }
                    }}
                    className={`grid grid-cols-[30px_1fr_120px_80px_60px_100px] gap-4 p-3 items-center ${
                      draggingStatusId === s.id
                        ? "opacity-[0.45] bg-[#fff8f3]"
                        : dragOverStatusId === s.id
                          ? "shadow-[inset_0_2px_0_#f47a2a]"
                          : "hover:bg-gray-50/50"
                    }`}
                  >
                    <div
                      title="Drag to reorder"
                      aria-label="Drag to reorder"
                      className="text-gray-400 cursor-grab active:cursor-grabbing flex justify-center"
                      onMouseDown={() => {
                        dragFromHandleRef.current = true;
                      }}
                      onMouseUp={() => {
                        dragFromHandleRef.current = false;
                      }}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-[9px] w-[9px] shrink-0 rounded-full"
                        style={{ backgroundColor: statusDotHex(s.color) }}
                      />
                      <span className={`text-[13px] font-bold text-gray-900 truncate ${s.retired ? "line-through opacity-50" : ""}`}>{s.name}</span>
                    </div>
                    <div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        s.category === "done" ? "bg-green-50 text-green-700" :
                        s.category === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {s.category === "todo" ? "To do" : s.category === "in_progress" ? "In progress" : s.category === "done" ? "Done" : s.category.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      {s.is_initial ? (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Yes</span>
                      ) : (
                        <span className="text-[11px] text-gray-400">No</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">{index + 1}</div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEditStatus(s)} className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900">Edit</button>
                      <button
                        onClick={() => setConfirmDelStatusId(s.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-red-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        title="Delete status"
                        aria-label="Delete status"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Transitions Section */}
          <div className="p-5">
            <details className="group rounded-xl border border-[#e7e9ee] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-white px-4 py-[14px] [&::-webkit-details-marker]:hidden">
                <div>
                  <strong className="block text-[14px] font-semibold text-[#181b22]">Advanced Transition Rules</strong>
                  <span className="mt-0.5 block text-[11.5px] text-[#6f7785]">Open only when you need custom movement rules between statuses.</span>
                </div>
                <ChevronDown className="h-[15px] w-[15px] shrink-0 text-[#8f97a2] transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <div className="border-t border-[#e7e9ee] bg-[#fcfcfd] p-[14px]">
                <div className="overflow-auto rounded-[10px] border border-[#e7e9ee] bg-white">
                  <table className="w-full min-w-[820px] border-separate border-spacing-0 text-center text-[11.5px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 top-0 z-[3] min-w-[170px] border-b border-r border-[#e7e9ee] bg-[#fafbfc] px-[11px] py-2.5 text-left font-medium text-[#697180]">From ↓ / To →</th>
                        {displayStatuses.map((s, i) => (
                          <th
                            key={s.id}
                            className={`sticky top-0 z-[2] min-w-24 border-b border-[#e7e9ee] bg-[#fafbfc] px-[11px] py-2.5 font-medium text-[#697180] ${i === displayStatuses.length - 1 ? "border-r-0" : "border-r"}`}
                          >
                            {s.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayStatuses.map((from) => (
                        <tr key={from.id}>
                          <td className="sticky left-0 z-[1] min-w-[170px] border-b border-r border-[#e7e9ee] bg-white px-[11px] py-2.5 text-left font-semibold text-[#181b22]">{from.name}</td>
                          {displayStatuses.map((to, i) => {
                            const isSame = from.id === to.id;
                            const hasTransition = !!expandedTransitions.find((t) => t.from_status_id === from.id && t.to_status_id === to.id);
                            return (
                              <td
                                key={to.id}
                                className={`min-w-24 border-b border-[#e7e9ee] px-[11px] py-2.5 ${i === displayStatuses.length - 1 ? "border-r-0" : "border-r"} ${isSame ? "bg-[#fbfcfd] text-[#c2c8d0]" : "bg-white"}`}
                              >
                                {isSame ? (
                                  "—"
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={hasTransition}
                                    onChange={() => toggleTransition(from.id, to.id)}
                                    className="m-0 inline-grid size-[17px] cursor-pointer appearance-none place-content-center rounded-[4px] border-[1.5px] border-[#b9c1cc] bg-white checked:border-[#f47a2a] checked:bg-[#f47a2a] checked:after:text-[11px] checked:after:font-extrabold checked:after:leading-none checked:after:text-white checked:after:content-['✓'] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f47a2a]/30"
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
              </div>
            </details>
          </div>
          
          <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="font-semibold text-gray-600" onClick={() => setExpandedId(null)} disabled={savingChanges}>Cancel</Button>
            <Button size="sm" className="bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold" onClick={saveChanges} disabled={savingChanges}>
              {savingChanges ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {savingChanges ? "Saving…" : "Save Changes"}
            </Button>
          </div>

        </div>
      ) : (
        <div className="text-center p-16 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <GitBranch className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No template selected</h3>
          <p className="text-xs">Select a template above or create a new one.</p>
        </div>
      )}

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={(open) => { if (!savingTemplate) setTemplateDialogOpen(open); }}>
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
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={savingTemplate}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={savingTemplate} className="bg-[#EB5A1E] hover:bg-[#C64715] text-white">
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {savingTemplate ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => { if (!savingStatus) setStatusDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editStatusId ? "Edit Status" : "New Status"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} placeholder="e.g. QA Review" />
            </div>
            <div>
              <Label>System State</Label>
              <Select value={statusCategory} onValueChange={setStatusCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color Tag</Label>
              <Select value={statusColor} onValueChange={setStatusColor}>
                <SelectTrigger>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: statusDotHex(statusColor) }}
                    />
                    {COLOR_OPTIONS.find((c) => c.value === statusColor)?.label
                      || COLOR_OPTIONS.find((c) => c.dot === statusDotHex(statusColor))?.label
                      || "Color"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.dot }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order (1 is first)</Label>
              <Input type="number" min={1} value={statusSortOrder} onChange={(e) => setStatusSortOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={statusInitial} onChange={(e) => setStatusInitial(e.target.checked)} className="h-4 w-4 text-orange-500 rounded border-gray-300" id="initialCheck" />
              <Label htmlFor="initialCheck" className="cursor-pointer font-normal">Set as the initial status</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={statusRetired} onChange={(e) => setStatusRetired(e.target.checked)} className="h-4 w-4 text-orange-500 rounded border-gray-300" id="retiredCheck" />
              <Label htmlFor="retiredCheck" className="cursor-pointer font-normal text-gray-500">Retired (hidden from new tasks)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={savingStatus}>Cancel</Button>
            <Button onClick={saveStatus} disabled={savingStatus} className="bg-[#EB5A1E] hover:bg-[#C64715] text-white">
              {savingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {savingStatus ? "Saving…" : "Save Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!confirmDelTemplateId} onOpenChange={(open) => !open && setConfirmDelTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow template?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this template and all its statuses and transitions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelTemplateId) deleteTemplate(confirmDelTemplateId); setConfirmDelTemplateId(null); }} className="bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelStatusId} onOpenChange={(open) => !open && setConfirmDelStatusId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete status?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this status and all its transitions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelStatusId) deleteStatus(confirmDelStatusId); setConfirmDelStatusId(null); }} className="bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
