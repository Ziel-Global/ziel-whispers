import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Plus, X } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = { high: "bg-red-100 text-red-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-green-100 text-green-800" };

export default function GoalNewPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [resourceTasks, setResourceTasks] = useState<Record<string, string[]>>({});
  const resourceTasksRef = useRef<Record<string, string[]>>({});
  const syncResourceTasks = (updater: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
    if (typeof updater === "function") {
      setResourceTasks((prev) => {
        const next = updater(prev);
        resourceTasksRef.current = next;
        return next;
      });
    } else {
      resourceTasksRef.current = updater;
      setResourceTasks(updater);
    }
  };
  const [resourceSearch, setResourceSearch] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetResource, setAssignTargetResource] = useState<string | null>(null);
  const [assignSelectedTasks, setAssignSelectedTasks] = useState<string[]>([]);
  const [resourcePopoverOpen, setResourcePopoverOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: projectMembers } = useQuery({
    queryKey: ["project-members-list", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase
        .from("project_members")
        .select("user_id, users(id, full_name, designation)")
        .eq("project_id", selectedProject)
        .is("removed_at", null);
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const { data: unlinkedTasks } = useQuery({
    queryKey: ["project-unlinked-tasks", selectedProject],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase
        .from("tasks")
        .select("id, title, priority, description")
        .eq("project_id", selectedProject)
        .eq("status", "unlinked")
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const members = projectMembers?.map((pm) => (pm.users as any)) || [];
  const availableMembers = members.filter((m: any) =>
    m.full_name.toLowerCase().includes(resourceSearch.toLowerCase())
  );

  const toggleResource = (userId: string) => {
    setSelectedResources((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
    if (!selectedResources.includes(userId)) {
      syncResourceTasks((prev) => ({ ...prev, [userId]: [] }));
    } else {
      syncResourceTasks((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  };

  const openAssignDialog = (userId: string) => {
    setAssignTargetResource(userId);
    setAssignSelectedTasks(resourceTasks[userId] || []);
    setAssignDialogOpen(true);
  };

  const saveAssignments = () => {
    if (!assignTargetResource) return;
    syncResourceTasks((prev) => ({ ...prev, [assignTargetResource]: assignSelectedTasks }));
    setAssignDialogOpen(false);
    setAssignTargetResource(null);
  };

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    setSelectedResources([]);
    syncResourceTasks({});
  };

  // Tasks available for a resource in the assign dialog
  const tasksAssignedToOthers = Object.entries(resourceTasks)
    .filter(([uid]) => uid !== assignTargetResource)
    .flatMap(([, tids]) => tids);

  const availableForAssign = (unlinkedTasks || []).filter(
    (t) => !tasksAssignedToOthers.includes(t.id)
  );

  const handleLaunch = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!selectedProject) { toast.error("Project is required"); return; }
    if (!dueDate) { toast.error("Due date is required"); return; }
    if (selectedResources.length === 0) { toast.error("At least one resource is required"); return; }
    setSaving(true);
    try {
      const { data: goal, error: goalError } = await supabase
        .from("goals")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          project_id: selectedProject,
          created_by: profile?.id,
        })
        .select("id")
        .single();
      if (goalError) throw goalError;

      const resourceRows = selectedResources.map((uid) => ({
        goal_id: goal.id,
        user_id: uid,
      }));
      const { error: resError } = await supabase.from("goal_resources").insert(resourceRows);
      if (resError) throw resError;

      const tasksToUpdate = resourceTasksRef.current;
      for (const [userId, taskIds] of Object.entries(tasksToUpdate)) {
        if (taskIds.length === 0) continue;
        const { error: taskError } = await supabase
          .from("tasks")
          .update({ goal_id: goal.id, assigned_to: userId, status: "linked" })
          .in("id", taskIds);
        if (taskError) throw taskError;
      }

      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "goal.created",
        target_entity: "goals",
        target_id: goal.id,
        metadata: { project_id: selectedProject, resource_count: selectedResources.length, task_count: Object.values(resourceTasks).flat().length },
      });

      toast.success("Goal launched");
      navigate(`/goals/${goal.id}`);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const resourceName = (uid: string) => members.find((m: any) => m.id === uid)?.full_name || "Unknown";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/goals"); }}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold tracking-tight">New Goal</h1>
      </div>

      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Due Date *</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Project *</label>
          <Select value={selectedProject} onValueChange={handleProjectChange}>
            <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
            <SelectContent>
              {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedProject && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Resources</label>
            <Popover open={resourcePopoverOpen} onOpenChange={setResourcePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-10">
                  {selectedResources.length === 0 ? (
                    <span className="text-muted-foreground">Select resources...</span>
                  ) : (
                    <span>{selectedResources.length} resource{selectedResources.length !== 1 ? "s" : ""} selected</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-3" align="start">
                <div className="space-y-2">
                  <Input
                    placeholder="Search resources..."
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {availableMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {resourceSearch ? "No matching members" : "No members in this project"}
                      </p>
                    ) : (
                      availableMembers.map((m: any) => {
                        const isSelected = selectedResources.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleResource(m.id)}
                            />
                            <div className="min-w-0">
                              <span className="text-sm font-medium block truncate">{m.full_name}</span>
                              <span className="text-xs text-muted-foreground block truncate">{m.designation}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <Button size="sm" className="w-full" onClick={() => setResourcePopoverOpen(false)}>
                    Done
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {selectedResources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedResources.map((uid) => (
                  <Badge key={uid} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs font-normal">
                    {resourceName(uid)}
                    <button
                      onClick={() => toggleResource(uid)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Resources with Task Assignments */}
        {selectedResources.length > 0 && (
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">Assigned Resources & Tasks</label>
            {selectedResources.map((uid) => {
              const assignedTaskIds = resourceTasks[uid] || [];
              const assignedTaskObjects = unlinkedTasks?.filter((t) => assignedTaskIds.includes(t.id)) || [];
              return (
                <Card key={uid} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-sm">{resourceName(uid)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{assignedTaskIds.length} task{assignedTaskIds.length !== 1 ? "s" : ""}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openAssignDialog(uid)} className="rounded-button"><Plus className="h-3 w-3 mr-1" />Assign Tasks</Button>
                  </div>
                  {assignedTaskObjects.length > 0 ? (
                    <div className="space-y-1">
                      {assignedTaskObjects.map((t) => (
                        <div key={t.id} className="flex items-center justify-between bg-muted/50 rounded p-2 text-sm">
                          <span>{t.title}</span>
                          <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No tasks assigned</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={saving || !title.trim() || !selectedProject || selectedResources.length === 0}
          className="rounded-button"
        >
          {saving ? "Launching..." : "Launch Goal"}
        </Button>
      </div>

      {/* Assign Tasks Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Tasks — {assignTargetResource ? resourceName(assignTargetResource) : ""}</DialogTitle></DialogHeader>
          {availableForAssign.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No unlinked tasks available for this project</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {availableForAssign.map((t) => {
                const checked = assignSelectedTasks.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        setAssignSelectedTasks((prev) =>
                          prev.includes(t.id) ? prev.filter((tid) => tid !== t.id) : [...prev, t.id]
                        );
                      }}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{t.title}</span>
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAssignments}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
