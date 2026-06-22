import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAvatarUrl } from "@/lib/utils";
import { ArrowLeft, Pencil, Plus, X, Flag } from "lucide-react";
import { format } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = { high: "bg-red-100 text-red-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-green-100 text-green-800" };

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const { data: goal, isLoading } = useQuery({
    queryKey: ["goal", id],
    queryFn: async () => {
      const { data } = await supabase.from("goals").select("*, projects(name)").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: resources } = useQuery({
    queryKey: ["goal-resources", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("goal_resources")
        .select("*, users(id, full_name, designation, avatar_url)")
        .eq("goal_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: tasks } = useQuery({
    queryKey: ["goal-tasks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, users!tasks_assigned_to_fkey(full_name)")
        .eq("goal_id", id!)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editResources, setEditResources] = useState<string[]>([]);
  const [editResourceTasks, setEditResourceTasks] = useState<Record<string, string[]>>({});
  const editResourceTasksRef = useRef<Record<string, string[]>>({});
  const syncEditResourceTasks = (updater: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
    if (typeof updater === "function") {
      setEditResourceTasks((prev) => { const n = updater(prev); editResourceTasksRef.current = n; return n; });
    } else {
      editResourceTasksRef.current = updater;
      setEditResourceTasks(updater);
    }
  };
  const [editResourceSearch, setEditResourceSearch] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetResource, setAssignTargetResource] = useState<string | null>(null);
  const [assignSelectedTasks, setAssignSelectedTasks] = useState<string[]>([]);
  const [editResourcePopoverOpen, setEditResourcePopoverOpen] = useState(false);
  const [editDueDate, setEditDueDate] = useState("");

  const { data: editProjects } = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: editProjectMembers } = useQuery({
    queryKey: ["project-members-list", editProject],
    queryFn: async () => {
      if (!editProject) return [];
      const { data } = await supabase
        .from("project_members")
        .select("user_id, users(id, full_name, designation)")
        .eq("project_id", editProject)
        .is("removed_at", null);
      return data || [];
    },
    enabled: !!editProject,
  });

  const { data: editUnlinkedTasks } = useQuery({
    queryKey: ["project-tasks-for-assign", editProject, id],
    queryFn: async () => {
      if (!editProject || !id) return [];
      const { data } = await supabase
        .from("tasks")
        .select("id, title, priority")
        .eq("project_id", editProject)
        .or(`status.eq.unlinked,and(status.eq.linked,goal_id.eq.${id})`)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!editProject && !!id,
  });

  const openEdit = () => {
    if (!goal) return;
    setEditTitle(goal.title);
    setEditDescription(goal.description || "");
    setEditProject(goal.project_id);
    const resourceIds = (resources || []).map((r) => (r.users as any)?.id).filter(Boolean);
    setEditResources(resourceIds);
    const taskMap: Record<string, string[]> = {};
    (tasks || []).forEach((t) => {
      if (t.assigned_to) {
        if (!taskMap[t.assigned_to]) taskMap[t.assigned_to] = [];
        taskMap[t.assigned_to].push(t.id);
      }
    });
    editResourceTasksRef.current = taskMap;
    setEditResourceTasks(taskMap);
    setEditResourceSearch("");
    setEditDueDate(goal.due_date || "");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditResourceSearch("");
  };

  const editMembers = editProjectMembers?.map((pm) => (pm.users as any)) || [];
  const editAvailableMembers = editMembers.filter((m: any) =>
    m.full_name.toLowerCase().includes(editResourceSearch.toLowerCase())
  );

  const toggleEditResource = (userId: string) => {
    setEditResources((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
    if (!editResources.includes(userId)) {
      syncEditResourceTasks((prev) => ({ ...prev, [userId]: [] }));
    } else {
      syncEditResourceTasks((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  };

  const openAssignDialog = (userId: string) => {
    setAssignTargetResource(userId);
    setAssignSelectedTasks(editResourceTasksRef.current[userId] || []);
    setAssignDialogOpen(true);
  };

  const saveAssignments = () => {
    if (!assignTargetResource) return;
    syncEditResourceTasks((prev) => ({ ...prev, [assignTargetResource]: assignSelectedTasks }));
    setAssignDialogOpen(false);
    setAssignTargetResource(null);
  };

  const removeTaskFromResource = (userId: string, taskId: string) => {
    syncEditResourceTasks((prev) => ({
      ...prev,
      [userId]: (prev[userId] || []).filter((tid) => tid !== taskId),
    }));
  };

  const editTasksAssignedToOthers = Object.entries(editResourceTasksRef.current)
    .filter(([uid]) => uid !== assignTargetResource)
    .flatMap(([, tids]) => tids);

  const editAvailableForAssign = (editUnlinkedTasks || []).filter(
    (t) => !editTasksAssignedToOthers.includes(t.id)
  );

  const editResourceName = (uid: string) => editMembers.find((m: any) => m.id === uid)?.full_name || "Unknown";

  const handleEditSave = async () => {
    if (!editTitle.trim()) { toast.error("Title is required"); return; }
    if (!editProject) { toast.error("Project is required"); return; }
    setEditSaving(true);
    try {
      const projectChanged = editProject !== goal?.project_id;

      if (projectChanged) {
        await supabase.from("tasks").update({ goal_id: null }).eq("goal_id", id!);
      }

      const { error: goalError } = await supabase
        .from("goals")
        .update({ title: editTitle.trim(), description: editDescription.trim() || null, due_date: editDueDate || null, project_id: editProject })
        .eq("id", id!);
      if (goalError) throw goalError;

      const currentResourceIds = (resources || []).map((r) => (r.users as any)?.id).filter(Boolean);
      const toRemove = currentResourceIds.filter((uid) => !editResources.includes(uid));
      const toAdd = editResources.filter((uid) => !currentResourceIds.includes(uid));

      if (toRemove.length > 0) {
        for (const uid of toRemove) {
          await supabase.from("goal_resources").delete().eq("goal_id", id!).eq("user_id", uid);
        }
        const tasksToUnlink: string[] = [];
        (tasks || []).forEach((t) => {
          if (t.assigned_to && toRemove.includes(t.assigned_to)) tasksToUnlink.push(t.id);
        });
        if (tasksToUnlink.length > 0) {
          await supabase.from("tasks").update({ goal_id: null }).in("id", tasksToUnlink);
        }
      }

      if (toAdd.length > 0) {
        const { error: addError } = await supabase.from("goal_resources").insert(
          toAdd.map((uid) => ({ goal_id: id!, user_id: uid }))
        );
        if (addError) throw addError;
      }

      const currentTaskIds = new Set((tasks || []).map((t) => t.id));
      const newTaskMap = editResourceTasksRef.current;
      const allNewTaskIds = new Set(Object.values(newTaskMap).flat());
      const tasksToUnlink = (tasks || []).filter((t) => !allNewTaskIds.has(t.id)).map((t) => t.id);
      if (tasksToUnlink.length > 0) {
        await supabase.from("tasks").update({ goal_id: null }).in("id", tasksToUnlink);
      }
      for (const [userId, taskIds] of Object.entries(newTaskMap)) {
        if (taskIds.length === 0) continue;
        const { error: taskError } = await supabase
          .from("tasks")
          .update({ goal_id: id!, assigned_to: userId })
          .in("id", taskIds);
        if (taskError) throw taskError;
      }

      await supabase.from("audit_logs").insert({
        actor_id: profile?.id, action: "goal.updated", target_entity: "goals", target_id: id,
        metadata: { project_changed: projectChanged, resource_count: editResources.length, task_count: Object.values(newTaskMap).flat().length },
      });

      toast.success("Goal updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["goal", id] });
      queryClient.invalidateQueries({ queryKey: ["goal-resources", id] });
      queryClient.invalidateQueries({ queryKey: ["goal-tasks", id] });
    } catch (err: any) { toast.error(err.message); } finally { setEditSaving(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (!goal) return <div className="text-center py-12 text-muted-foreground">Goal not found</div>;

  const tasksByUser: Record<string, any[]> = {};
  tasks?.forEach((t) => {
    const uid = t.assigned_to || "unassigned";
    if (!tasksByUser[uid]) tasksByUser[uid] = [];
    tasksByUser[uid].push(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/goals"); }}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{goal.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground text-sm">{(goal.projects as any)?.name}</span>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={openEdit} className="rounded-button"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
        )}
      </div>

      {goal.description && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{goal.description}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Task Progress</span>
          <span className="text-sm text-muted-foreground">
            {tasks?.filter((t) => t.status === "complete").length || 0} / {tasks?.length || 0} complete
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div
            className="bg-primary h-2.5 rounded-full transition-all"
            style={{ width: `${tasks && tasks.length > 0 ? ((tasks.filter((t) => t.status === "complete").length / tasks.length) * 100) : 0}%` }}
          />
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Resources ({resources?.length || 0})</h2>
        {!resources || resources.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No resources assigned</Card>
        ) : (
          resources.map((r) => {
            const user = r.users as any;
            const userTasks = tasksByUser[user?.id] || [];
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
                    <AvatarFallback className="text-xs">{(user?.full_name || "?")[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.designation}</p>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground">{userTasks.length} task{userTasks.length !== 1 ? "s" : ""}</div>
                </div>
                {userTasks.length > 0 ? (
                  <div className="space-y-1.5 pl-11">
                    {userTasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between bg-muted/50 rounded p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{t.title}</span>
                          {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs">{t.status.replace(/_/g, " ")}</Badge>
                          {t.estimated_hours && <Badge variant="secondary" className="text-xs">{t.estimated_hours}h</Badge>}
                          <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-11 italic">No tasks assigned</p>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Goal title" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Optional description" rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date *</label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Project *</label>
              <Select value={editProject} onValueChange={(v) => { setEditProject(v); setEditResources([]); syncEditResourceTasks({}); }}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {editProjects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {editProject && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Resources</label>
                <Popover open={editResourcePopoverOpen} onOpenChange={setEditResourcePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-10">
                      {editResources.length === 0 ? (
                        <span className="text-muted-foreground">Select resources...</span>
                      ) : (
                        <span>{editResources.length} resource{editResources.length !== 1 ? "s" : ""} selected</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-3" align="start">
                    <div className="space-y-2">
                      <Input
                        placeholder="Search resources..."
                        value={editResourceSearch}
                        onChange={(e) => setEditResourceSearch(e.target.value)}
                      />
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {editAvailableMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {editResourceSearch ? "No matching members" : "No members in this project"}
                          </p>
                        ) : (
                          editAvailableMembers.map((m: any) => {
                            const isSelected = editResources.includes(m.id);
                            return (
                              <label
                                key={m.id}
                                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleEditResource(m.id)}
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
                      <Button size="sm" className="w-full" onClick={() => setEditResourcePopoverOpen(false)}>
                        Done
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                {editResources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {editResources.map((uid) => (
                      <Badge key={uid} variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs font-normal">
                        {editResourceName(uid)}
                        <button
                          onClick={() => toggleEditResource(uid)}
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

            {editResources.length > 0 && (
              <div className="space-y-3 pt-2">
                <label className="text-sm font-medium">Assigned Resources & Tasks</label>
                {editResources.map((uid) => {
                  const assignedTaskIds = editResourceTasksRef.current[uid] || [];
                  const assignedTaskObjects = [
                    ...(editUnlinkedTasks || []).filter((t) => assignedTaskIds.includes(t.id)),
                    ...(tasks || []).filter((t) => t.assigned_to === uid && assignedTaskIds.includes(t.id)),
                  ];
                  const seen = new Set<string>();
                  const deduped = assignedTaskObjects.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
                  return (
                    <Card key={uid} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-sm">{editResourceName(uid)}</span>
                          <span className="text-xs text-muted-foreground ml-2">{assignedTaskIds.length} task{assignedTaskIds.length !== 1 ? "s" : ""}</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openAssignDialog(uid)} className="rounded-button"><Plus className="h-3 w-3 mr-1" />Assign Tasks</Button>
                      </div>
                      {deduped.length > 0 ? (
                        <div className="space-y-1">
                          {deduped.map((t) => (
                            <div key={t.id} className="flex items-center justify-between bg-muted/50 rounded p-2 text-sm">
                          <span>
                            {t.title}
                            {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5" />}
                          </span>
                              <div className="flex items-center gap-1">
                                <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                                <button
                                  onClick={() => removeTaskFromResource(uid, t.id)}
                                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
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
          </div>
          <DialogFooter className="px-6 pb-6 pt-3 shrink-0 border-t">
            <Button variant="outline" onClick={closeEdit} disabled={editSaving}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editTitle.trim() || !editProject}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tasks Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Tasks — {assignTargetResource ? editResourceName(assignTargetResource) : ""}</DialogTitle></DialogHeader>
          {editAvailableForAssign.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks available for this project</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {editAvailableForAssign.map((t) => {
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
