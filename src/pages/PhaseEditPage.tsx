import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toSlug } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { ArrowLeft, Save, Check } from "lucide-react";
import { format } from "date-fns";
import { PRIORITY_COLORS, TASK_STATUS_COLORS as STATUS_COLORS } from "@/lib/workflow";

export default function PhaseEditPage() {
  const { slug, phaseId } = useParams<{ slug: string; phaseId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [editingTitle, setEditingTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [taskFilter, setTaskFilter] = useState<string>("all");

  const { data: resolvedId } = useQuery({
    queryKey: ["resolve-project-slug", slug],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name");
      const match = (data || []).find((p: any) => toSlug(p.name) === slug);
      return match?.id || null;
    },
    enabled: !!slug,
  });

  const projectId = resolvedId;

  const { data: phase, isLoading: phaseLoading } = useQuery({
    queryKey: ["project-phase", phaseId],
    queryFn: async () => {
      const { data } = await supabase.from("project_phases").select("*").eq("id", phaseId!).single();
      if (data) {
        setEditingTitle(data.title);
        setEditingDueDate(data.due_date || "");
      }
      return data;
    },
    enabled: !!phaseId,
  });

  // Fetch all project tasks eligible for this phase:
  // phase_id IS NULL (unassigned) OR phase_id = this phase
  // Exclude tasks assigned to a different phase
  const { data: eligibleTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["phase-eligible-tasks", projectId, phaseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, users:assigned_to(full_name)")
        .eq("project_id", projectId!)
        .or(`phase_id.is.null,phase_id.eq.${phaseId}`)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!projectId && !!phaseId,
  });

  const assignedTaskIds = useMemo(
    () => new Set(eligibleTasks.filter((t: any) => t.phase_id === phaseId).map((t: any) => t.id)),
    [eligibleTasks, phaseId]
  );

  // Sync selectedTaskIds with currently assigned tasks once loaded
  useEffect(() => {
    if (eligibleTasks.length > 0 && selectedTaskIds.size === 0 && assignedTaskIds.size > 0) {
      setSelectedTaskIds(new Set(assignedTaskIds));
    }
  }, [eligibleTasks, assignedTaskIds]);

  const handleSaveAll = async () => {
    if (!editingTitle.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const { error: phaseError } = await supabase.from("project_phases").update({
        title: editingTitle.trim(),
        due_date: editingDueDate || null,
      }).eq("id", phaseId!);
      if (phaseError) throw phaseError;

      const toUnassign = eligibleTasks.filter(
        (t: any) => t.phase_id === phaseId && !selectedTaskIds.has(t.id)
      );
      const toAssign = eligibleTasks.filter(
        (t: any) => t.phase_id !== phaseId && selectedTaskIds.has(t.id)
      );

      const unassignIds = toUnassign.map((t: any) => t.id);

      if (unassignIds.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .update({ phase_id: null, status: "unlinked" })
          .in("id", unassignIds);
        if (error) throw error;
      }

      if (toAssign.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .update({ phase_id: phaseId!, status: "linked" })
          .in("id", toAssign.map((t: any) => t.id));
        if (error) throw error;
      }

      toast.success("All changes saved");
      queryClient.invalidateQueries({ queryKey: ["project-phase", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-eligible-tasks", projectId, phaseId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  if (!isAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Access denied</div>;
  }

  if (phaseLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  }

  if (!phase) {
    return <div className="text-center py-12 text-muted-foreground">Phase not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate(`/projects/${slug}`); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight flex-1">Edit Phase</h1>
        <Button onClick={handleSaveAll} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} placeholder="Phase title" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date</label>
            <Input type="date" value={editingDueDate} onChange={(e) => setEditingDueDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Tasks ({eligibleTasks.length})
          </h2>
          <Select value={taskFilter} onValueChange={setTaskFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {eligibleTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks available for this project.</p>
        ) : (
          <div>
            <TableHeader gridCols="40px 1fr 112px 80px 96px 80px">
              <span></span>
              <span>TASK</span>
              <span>ASSIGNEE</span>
              <span>EST.</span>
              <span>STATUS</span>
              <span>PRIORITY</span>
            </TableHeader>
            {[...eligibleTasks].filter((t: any) => {
              if (taskFilter === "all") return true;
              if (taskFilter === "complete") return t.status === "complete";
              if (taskFilter === "linked") return t.status === "linked";
              return true;
            }).sort((a: any, b: any) => {
              const aChecked = selectedTaskIds.has(a.id) ? 1 : 0;
              const bChecked = selectedTaskIds.has(b.id) ? 1 : 0;
              return bChecked - aChecked;
            }).map((t: any) => {
              const checked = selectedTaskIds.has(t.id);
              return (
                <DataRow
                  key={t.id}
                  gridCols="40px 1fr 112px 80px 96px 80px"
                  className={checked ? "bg-primary/5" : ""}
                >
                  <button
                    onClick={() => toggleTask(t.id)}
                    className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? "bg-primary border-primary text-white" : "border-[#d1d5db]"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </button>
                  <div>
                    <RowPrimary>{t.title}</RowPrimary>
                    {checked && <RowSecondary>Assigned</RowSecondary>}
                  </div>
                  <RowDataItem label="ASSIGNEE">{(t as any).users?.full_name || "—"}</RowDataItem>
                  <RowDataItem label="EST.">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</RowDataItem>
                  <RowBadgeItem label="STATUS"><Badge className={STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge></RowBadgeItem>
                  <RowBadgeItem label="PRIORITY"><Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge></RowBadgeItem>
                </DataRow>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
