import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Pencil } from "lucide-react";

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

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

  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);
  const [confirmDelTemplateId, setConfirmDelTemplateId] = useState<string | null>(null);
  const [confirmDelStatusId, setConfirmDelStatusId] = useState<string | null>(null);

  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [hoveredStatusId, setHoveredStatusId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

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

  const expandedStatuses = selectedTemplateId ? (statusesMap?.[selectedTemplateId] || []) : [];
  const expandedTransitions = selectedTemplateId ? (transitionsMap?.[selectedTemplateId] || []) : [];
  const selectedTemplate = (templates || []).find((t) => t.id === selectedTemplateId);

  function getCategoryBg(category: string) {
    if (category === "in_progress") return "#F59E0B";
    if (category === "done") return "#16A34A";
    return "#3B82F6";
  }

  function getCategoryLabel(category: string) {
    if (category === "in_progress") return "In progress";
    if (category === "done") return "Done";
    return "To do";
  }

  function openNewTemplate() {
    setEditTemplateId(null);
    setTemplateName("");
    setTemplateDesc("");
    setTemplateDialogOpen(true);
  }

  async function saveTemplate() {
    if (!templateName.trim()) { toast.error("Name is required"); return; }
    if (editTemplateId) {
      await supabase.from("workflow_templates").update({ name: templateName.trim(), description: templateDesc.trim() || null }).eq("id", editTemplateId);
    } else {
      const { data: newTemplate } = await supabase.from("workflow_templates").insert({ name: templateName.trim(), description: templateDesc.trim() || null, created_by: profile?.id }).select().single();
      if (newTemplate) setSelectedTemplateId(newTemplate.id);
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    setTemplateDialogOpen(false);
    toast.success(editTemplateId ? "Template updated" : "Template created");
  }

  async function deleteTemplate(id: string) {
    await supabase.from("workflow_templates").delete().eq("id", id);
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    toast.success("Template deleted");
  }

  async function renameTemplate() {
    if (!renameValue.trim() || !selectedTemplateId) { toast.error("Name is required"); return; }
    await supabase.from("workflow_templates").update({ name: renameValue.trim() }).eq("id", selectedTemplateId);
    queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
    setRenameDialogOpen(false);
    toast.success("Template renamed");
  }

  function openNewStatus() {
    setEditStatusId(null);
    setStatusName("");
    setStatusCategory("todo");
    setStatusColor("bg-gray-100 text-gray-800");
    setStatusInitial(false);
    setStatusDialogOpen(true);
  }

  function openEditStatus(s: WorkflowStatus) {
    setEditStatusId(s.id);
    setStatusName(s.name);
    setStatusCategory(s.category);
    setStatusColor(s.color);
    setStatusInitial(s.is_initial);
    setStatusDialogOpen(true);
  }

  async function saveStatus() {
    if (!statusName.trim() || !selectedTemplateId) { toast.error("Name is required"); return; }
    const maxOrder = expandedStatuses.reduce((max, s) => Math.max(max, s.sort_order), 0);
    if (editStatusId) {
      const update: Partial<WorkflowStatus> = { name: statusName.trim(), category: statusCategory, color: statusColor, is_initial: statusInitial };
      await supabase.from("workflow_statuses").update(update).eq("id", editStatusId);
    } else {
      await supabase.from("workflow_statuses").insert({
        workflow_template_id: selectedTemplateId, name: statusName.trim(), category: statusCategory, color: statusColor, sort_order: maxOrder + 1, is_initial: statusInitial,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-statuses"] });
    setStatusDialogOpen(false);
    toast.success(editStatusId ? "Status updated" : "Status created");
  }

  async function deleteStatus(id: string) {
    setDeletingStatusId(id);
    await supabase.from("workflow_statuses").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["workflow-statuses"] });
    queryClient.invalidateQueries({ queryKey: ["workflow-transitions"] });
    setDeletingStatusId(null);
    toast.success("Status deleted");
  }

  async function toggleTransition(fromId: string, toId: string) {
    if (!selectedTemplateId) return;
    const existing = expandedTransitions.find((t) => t.from_status_id === fromId && t.to_status_id === toId);
    if (existing) {
      await supabase.from("workflow_transitions").delete().eq("id", existing.id);
    } else {
      await supabase.from("workflow_transitions").insert({ workflow_template_id: selectedTemplateId, from_status_id: fromId, to_status_id: toId });
    }
    queryClient.invalidateQueries({ queryKey: ["workflow-transitions"] });
  }

  function isTransitionConnected(fromId: string, toId: string) {
    return expandedTransitions.some((t) => t.from_status_id === fromId && t.to_status_id === toId);
  }

  return (
    <div className="p-6 pb-24 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#09090B" }}>Workflow Templates</h1>
          <p style={{ fontSize: "14px", color: "#71717A", marginTop: "4px" }}>Create and manage reusable workflow templates with a cleaner, builder-focused layout.</p>
        </div>
        <button
          onClick={openNewTemplate}
          style={{ backgroundColor: "#EC6824", color: "#fff", fontWeight: 600, fontSize: "14px", padding: "8px 16px", borderRadius: "8px", height: "38px", cursor: "pointer", border: "none" }}
        >
          New Template
        </button>
      </div>

      {/* Template Selector */}
      <div className="flex items-center gap-4">
        <div className="relative" style={{ flex: 1, maxWidth: "360px" }}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#EC6824" }} />
          <Select
            value={selectedTemplateId || ""}
            onValueChange={(v) => { setSelectedTemplateId(v); setRulesExpanded(false); setHoveredStatusId(null); }}
          >
            <SelectTrigger style={{ paddingLeft: "28px", height: "42px", borderColor: "#E4E4E7", borderRadius: "8px", outline: "none", boxShadow: "none" }}>
              <SelectValue placeholder="Select a workflow template" />
            </SelectTrigger>
            <SelectContent>
              {(templates || []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p style={{ fontSize: "13px", color: "#71717A" }}>Choose which workflow you want to edit</p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Selected Template */}
      {selectedTemplate && !isLoading && (
        <div style={{ border: "1px solid #E4E4E7", borderRadius: "12px", padding: "20px", backgroundColor: "#fff" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#09090B" }}>{selectedTemplate.name}</h2>
              <p style={{ fontSize: "13px", color: "#71717A", marginTop: "4px" }}>
                Workflow template &bull; Updated {new Date(selectedTemplate.created_at).toLocaleDateString()} &bull; {expandedStatuses.length} statuses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRenameValue(selectedTemplate.name); setRenameDialogOpen(true); }}
                style={{ border: "1px solid #E4E4E7", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", fontWeight: 500, color: "#3F3F46", backgroundColor: "#fff", cursor: "pointer" }}
              >
                Rename
              </button>
              <button
                onClick={() => setConfirmDelTemplateId(selectedTemplate.id)}
                style={{ backgroundColor: "#DC2626", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", border: "none" }}
              >
                <Trash2 className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Workflow Path Visualization */}
          {expandedStatuses.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#09090B" }}>Workflow Path</h3>
                  <span style={{ backgroundColor: "#16A34A", color: "#fff", fontSize: "11px", fontWeight: 600, padding: "2px 10px", borderRadius: "9999px" }}>Live preview</span>
                </div>
                <button
                  onClick={openNewStatus}
                  style={{ backgroundColor: "#EC6824", color: "#fff", fontWeight: 600, fontSize: "13px", padding: "6px 14px", borderRadius: "8px", height: "36px", cursor: "pointer", border: "none" }}
                >
                  Add Status
                </button>
              </div>
              <p style={{ fontSize: "13px", color: "#71717A", marginTop: "4px" }}>Keep the default path easy to follow. You can change the order anytime.</p>

              <div style={{ marginTop: "16px", border: "1px solid #E4E4E7", borderRadius: "12px", padding: "24px 20px", backgroundColor: "#FAFAFA", minHeight: "180px" }}>
                <div style={{ fontSize: "12px", color: "#A1A1AA", marginBottom: "16px" }}>
                  &mdash; &#8594; Transition &nbsp;|&nbsp; Hover a stage to focus only its incoming and outgoing transitions
                </div>

                <div className="flex items-center" style={{ gap: "16px", overflowX: "auto", padding: "20px 0" }}>
                  {expandedStatuses.map((s, idx) => {
                    const isHovered = hoveredStatusId === s.id;
                    const isConnected = hoveredStatusId
                      ? expandedTransitions.some((t) =>
                          (t.from_status_id === hoveredStatusId && t.to_status_id === s.id) ||
                          (t.to_status_id === hoveredStatusId && t.from_status_id === s.id)
                        )
                      : false;
                    const shouldDim = hoveredStatusId !== null && !isHovered && !isConnected;

                    return (
                      <div key={s.id} className="flex items-center" style={{ gap: "16px" }}>
                        <div
                          onMouseEnter={() => setHoveredStatusId(s.id)}
                          onMouseLeave={() => setHoveredStatusId(null)}
                          style={{
                            width: "160px",
                            border: "1px solid #E4E4E7",
                            borderRadius: "12px",
                            padding: "16px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            transition: "opacity 0.2s",
                            opacity: shouldDim ? 0.3 : 1,
                            flexShrink: 0,
                          }}
                        >
                          <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
                            <span style={{
                              width: "28px", height: "28px", borderRadius: "50%",
                              backgroundColor: getCategoryBg(s.category), color: "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "13px", fontWeight: 700, flexShrink: 0,
                            }}>{idx + 1}</span>
                            <span style={{ fontSize: "11px", color: getCategoryBg(s.category), fontWeight: 500 }}>{getCategoryLabel(s.category)}</span>
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "#09090B" }}>{s.name}</div>
                          <div style={{ fontSize: "11px", color: "#A1A1AA", marginTop: "4px" }}>Stage</div>
                        </div>
                        {idx < expandedStatuses.length - 1 && (
                          <div style={{ display: "flex", alignItems: "center", minWidth: "48px", flexShrink: 0 }}>
                            <div style={{ flex: 1, borderTop: "2px dashed #D4D4D8" }} />
                            <span style={{ color: "#A1A1AA", fontSize: "16px" }}>&#8594;</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Statuses Table */}
          {expandedStatuses.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#09090B" }}>Statuses</h3>
              <p style={{ fontSize: "13px", color: "#71717A", marginTop: "4px", marginBottom: "16px" }}>Manage the workflow statuses in one simple list.</p>

              <div style={{ border: "1px solid #E4E4E7", borderRadius: "12px", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 140px 80px 60px 100px", padding: "10px 16px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E4E4E7", fontSize: "12px", fontWeight: 600, color: "#71717A", letterSpacing: "0.05em" }}>
                  <span></span>
                  <span>STATUS</span>
                  <span>SYSTEM STATE</span>
                  <span>INITIAL</span>
                  <span>ORDER</span>
                  <span>ACTIONS</span>
                </div>
                {expandedStatuses.map((s) => (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 140px 80px 60px 100px", padding: "12px 16px", borderBottom: "1px solid #F4F4F5", alignItems: "center" }}>
                    <span style={{ color: "#A1A1AA", cursor: "grab" }}><GripVertical className="h-4 w-4" /></span>
                    <div className="flex items-center gap-2">
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: getCategoryBg(s.category), display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#09090B" }}>{s.name}</span>
                    </div>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: 500, color: "#fff", backgroundColor: getCategoryBg(s.category), width: "fit-content" }}>
                      {getCategoryLabel(s.category)}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: s.is_initial ? "#16A34A" : "#A1A1AA" }}>{s.is_initial ? "Yes" : "No"}</span>
                    <span style={{ fontSize: "13px", color: "#71717A" }}>{s.sort_order}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditStatus(s)} style={{ color: "#3B82F6", fontSize: "13px", fontWeight: 500, cursor: "pointer", background: "none", border: "none", padding: 0 }}>
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelStatusId(s.id)}
                        disabled={deletingStatusId === s.id}
                        style={{ backgroundColor: "#DC2626", borderRadius: "6px", padding: "4px 6px", cursor: "pointer", border: "none", opacity: deletingStatusId === s.id ? 0.5 : 1 }}
                        title="Delete status"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Transition Rules */}
          {expandedStatuses.length > 1 && (
            <div style={{ marginTop: "24px", border: "1px solid #E4E4E7", borderRadius: "12px", overflow: "hidden" }}>
              <button
                onClick={() => setRulesExpanded(!rulesExpanded)}
                className="flex items-center justify-between w-full"
                style={{ padding: "16px 20px", backgroundColor: "#fff", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#09090B" }}>Advanced Transition Rules</h3>
                  <p style={{ fontSize: "13px", color: "#71717A", marginTop: "2px" }}>Open only when you need custom movement rules between statuses.</p>
                </div>
                {rulesExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>

              {rulesExpanded && (
                <div style={{ padding: "0 20px 20px" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "10px 12px", border: "1px solid #E4E4E7", textAlign: "left", fontWeight: 500, color: "#71717A", backgroundColor: "#F9FAFB" }}>From / To &rarr;</th>
                          {expandedStatuses.map((s) => (
                            <th key={s.id} style={{ padding: "10px 12px", border: "1px solid #E4E4E7", textAlign: "center", fontWeight: 500, color: "#71717A", backgroundColor: "#F9FAFB" }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 500, color: "#fff", backgroundColor: getCategoryBg(s.category) }}>{s.name}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expandedStatuses.map((from) => (
                          <tr key={from.id}>
                            <td style={{ padding: "10px 12px", border: "1px solid #E4E4E7", fontWeight: 500 }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 500, color: "#fff", backgroundColor: getCategoryBg(from.category) }}>{from.name}</span>
                            </td>
                            {expandedStatuses.map((to) => (
                              <td key={to.id} style={{ padding: "10px 12px", border: "1px solid #E4E4E7", textAlign: "center" }}>
                                {from.id === to.id ? (
                                  <span style={{ color: "#D4D4D8" }}>&mdash;</span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={isTransitionConnected(from.id, to.id)}
                                    onChange={() => toggleTransition(from.id, to.id)}
                                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#EC6824" }}
                                  />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Footer */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTop: "1px solid #E4E4E7", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
        <p style={{ fontSize: "13px", color: "#71717A" }}>The layout is tightened so the page feels more compact and builder-focused.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedTemplateId(null); setRulesExpanded(false); setHoveredStatusId(null); }}
            style={{ border: "1px solid #E4E4E7", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, color: "#3F3F46", backgroundColor: "#fff", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => toast.success("Changes saved")}
            style={{ backgroundColor: "#EC6824", color: "#fff", fontWeight: 600, fontSize: "14px", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", border: "none" }}
          >
            Save Changes
          </button>
        </div>
      </div>

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
            <button
              onClick={() => setTemplateDialogOpen(false)}
              style={{ border: "1px solid #E4E4E7", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, color: "#3F3F46", backgroundColor: "#fff", cursor: "pointer" }}
            >Cancel</button>
            <button
              onClick={saveTemplate}
              style={{ backgroundColor: "#EC6824", color: "#fff", fontWeight: 600, fontSize: "14px", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", border: "none" }}
            >Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Template</DialogTitle></DialogHeader>
          <div>
            <Label>Name</Label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Template name" />
          </div>
          <DialogFooter>
            <button
              onClick={() => setRenameDialogOpen(false)}
              style={{ border: "1px solid #E4E4E7", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, color: "#3F3F46", backgroundColor: "#fff", cursor: "pointer" }}
            >Cancel</button>
            <button
              onClick={renameTemplate}
              style={{ backgroundColor: "#EC6824", color: "#fff", fontWeight: 600, fontSize: "14px", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", border: "none" }}
            >Save</button>
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
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={statusInitial} onChange={(e) => setStatusInitial(e.target.checked)} style={{ accentColor: "#EC6824" }} />
              <Label className="cursor-pointer">Initial status (default for new tasks)</Label>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setStatusDialogOpen(false)}
              style={{ border: "1px solid #E4E4E7", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", fontWeight: 500, color: "#3F3F46", backgroundColor: "#fff", cursor: "pointer" }}
            >Cancel</button>
            <button
              onClick={saveStatus}
              style={{ backgroundColor: "#EC6824", color: "#fff", fontWeight: 600, fontSize: "14px", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", border: "none" }}
            >Save</button>
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
    </div>
  );
}
