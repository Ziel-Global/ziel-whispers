import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DataRow, RowPrimary, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function PhaseEditPage() {
  const { slug, phaseId } = useParams<{ slug: string; phaseId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [editingTitle, setEditingTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [addSprintOpen, setAddSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");
  const [confirmSprintDelId, setConfirmSprintDelId] = useState<string | null>(null);

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

  const { data: phaseSprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["phase-sprints", phaseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sprints")
        .select("*")
        .eq("phase_id", phaseId!)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!phaseId && !!projectId,
  });

  const handleSaveAll = async () => {
    if (!editingTitle.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const { error: phaseError } = await supabase.from("project_phases").update({
        title: editingTitle.trim(),
        due_date: editingDueDate || null,
      }).eq("id", phaseId!);
      if (phaseError) throw phaseError;

      toast.success("All changes saved");
      queryClient.invalidateQueries({ queryKey: ["project-phase", phaseId] });
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleAddSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStartDate || !sprintEndDate) return;
    const { error } = await supabase.from("sprints").insert({
      project_id: projectId,
      phase_id: phaseId,
      name: sprintName.trim(),
      start_date: sprintStartDate,
      end_date: sprintEndDate,
      status: "planned",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Sprint created");
    setAddSprintOpen(false);
    setSprintName("");
    setSprintStartDate("");
    setSprintEndDate("");
    queryClient.invalidateQueries({ queryKey: ["phase-sprints", phaseId] });
  };

  const deleteSprint = async (sprintId: string) => {
    const { error } = await supabase.from("sprints").delete().eq("id", sprintId);
    if (error) { toast.error(error.message); return; }
    toast.success("Sprint deleted");
    setConfirmSprintDelId(null);
    queryClient.invalidateQueries({ queryKey: ["phase-sprints", phaseId] });
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
            Sprints ({phaseSprints.length})
          </h2>
          <Button size="sm" onClick={() => setAddSprintOpen(true)} className="rounded-button bg-primary text-black hover:bg-black hover:text-white">
            <Plus className="h-4 w-4 mr-1" /> Add Sprint
          </Button>
        </div>
        {sprintsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : phaseSprints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sprints in this phase yet.</p>
        ) : (
          <div>
            <TableHeader gridCols="1fr 112px 96px 80px">
              <span>SPRINT</span>
              <span>DATES</span>
              <span>STATUS</span>
              <span className="text-right">ACTIONS</span>
            </TableHeader>
            {phaseSprints.map((s: any) => (
              <DataRow key={s.id} gridCols="1fr 112px 96px 80px">
                <div>
                  <RowPrimary>{s.name}</RowPrimary>
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
                <RowActions className="justify-self-end">
                  <button onClick={() => setConfirmSprintDelId(s.id)} className={editButtonClass} title="Delete Sprint">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </RowActions>
              </DataRow>
            ))}
          </div>
        )}
      </Card>
      {/* Add Sprint Dialog */}
      <Dialog open={addSprintOpen} onOpenChange={setAddSprintOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sprint to {phase?.title}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddSprint} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="e.g. Sprint 1" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date *</label>
              <Input type="date" value={sprintStartDate} onChange={(e) => setSprintStartDate(e.target.value)} required max={sprintEndDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={sprintEndDate} onChange={(e) => setSprintEndDate(e.target.value)} required min={sprintStartDate || undefined} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddSprintOpen(false)}>Cancel</Button>
              <Button type="submit">Create Sprint</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Sprint Confirmation */}
      <AlertDialog open={!!confirmSprintDelId} onOpenChange={(open) => !open && setConfirmSprintDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sprint?</AlertDialogTitle>
            <AlertDialogDescription>This will unlink all tasks from this sprint and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmSprintDelId) deleteSprint(confirmSprintDelId); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
