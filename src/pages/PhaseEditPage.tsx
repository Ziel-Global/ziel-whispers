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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save } from "lucide-react";
import { format } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

const STATUS_COLORS: Record<string, string> = {
  unlinked: "bg-gray-100 text-gray-800",
  linked: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  complete: "bg-green-100 text-green-800",
  returned: "bg-red-100 text-red-800",
};

export default function PhaseEditPage() {
  const { slug, phaseId } = useParams<{ slug: string; phaseId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [editingTitle, setEditingTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

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
        .select("*")
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

  const handleSavePhase = async () => {
    if (!editingTitle.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("project_phases").update({
        title: editingTitle.trim(),
        due_date: editingDueDate || null,
      }).eq("id", phaseId!);
      if (error) throw error;
      toast.success("Phase updated");
      queryClient.invalidateQueries({ queryKey: ["project-phase", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleSaveTasks = async () => {
    setSavingTasks(true);
    try {
      // Tasks to unassign: currently assigned but not in selectedTaskIds
      const toUnassign = eligibleTasks
        .filter((t: any) => t.phase_id === phaseId && !selectedTaskIds.has(t.id))
        .map((t: any) => t.id);
      // Tasks to assign: selected but not currently assigned
      const toAssign = eligibleTasks
        .filter((t: any) => t.phase_id !== phaseId && selectedTaskIds.has(t.id))
        .map((t: any) => t.id);

      if (toUnassign.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .update({ phase_id: null, status: "unlinked" })
          .in("id", toUnassign);
        if (error) throw error;
      }

      if (toAssign.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .update({ phase_id: phaseId!, status: "linked" })
          .in("id", toAssign);
        if (error) throw error;
      }

      if (toUnassign.length > 0 || toAssign.length > 0) {
        toast.success("Task assignments saved");
        queryClient.invalidateQueries({ queryKey: ["phase-eligible-tasks", projectId, phaseId] });
        queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
        queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingTasks(false); }
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
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Phase</h1>
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
        <Button onClick={handleSavePhase} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save Phase"}
        </Button>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Tasks ({eligibleTasks.length})
          </h2>
          <Button onClick={handleSaveTasks} disabled={savingTasks}>
            <Save className="h-4 w-4 mr-2" />{savingTasks ? "Saving…" : "Save Assignments"}
          </Button>
        </div>
        {eligibleTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks available for this project.</p>
        ) : (
          <div className="space-y-2">
            {[...eligibleTasks].sort((a: any, b: any) => {
              const aChecked = selectedTaskIds.has(a.id) ? 1 : 0;
              const bChecked = selectedTaskIds.has(b.id) ? 1 : 0;
              return bChecked - aChecked;
            }).map((t: any) => {
              const checked = selectedTaskIds.has(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTask(t.id)}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.title}</span>
                      {checked && (
                        <span className="text-xs text-foreground font-medium">(assigned)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={STATUS_COLORS[t.status] || ""}>{t.status}</Badge>
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
