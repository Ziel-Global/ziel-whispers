import { TaskCollaboratorsSection } from "@/components/TaskCollaboratorsSection";
import { StageOutcomeSelector } from "@/components/StageOutcomeSelector";
import { getStatusDisplay, getStatusColor } from "@/lib/workflow";
import React, { useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Flag, Paperclip, Send, Trash2, Download, Upload, FileText, CheckCircle2, Clock, AlertCircle, Calendar as CalendarIcon, MessageSquare, Plus, Search, Eye, EyeOff, XCircle, Pencil, ArrowRightCircle, Info, List, Link2, LayoutGrid } from "lucide-react";
import { format } from "date-fns";
import { truncateWords, cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  bucketTaskState,
  PRIORITY_PILL_CLASS,
  STATUS_PILL_CLASS,
  type TaskStateBucket,
} from "@/lib/clientTaskBuckets";

const PROGRESS_BY_BUCKET: Record<TaskStateBucket, number> = {
  Unlinked: 0,
  Development: 50,
  Returned: 25,
  Complete: 100,
};

export interface TaskModalsProps {
  addTaskOpen: boolean;
  setAddTaskOpen: (open: boolean) => void;
  bulkTaskOpen: boolean;
  setBulkTaskOpen: (open: boolean) => void;
  editTaskOpen: boolean;
  setEditTaskOpen: (open: boolean) => void;
  viewTaskData: any;
  setViewTaskData: (task: any) => void;
  
  taskTitle: string; setTaskTitle: (v: string) => void;
  taskDescription: string; setTaskDescription: (v: string) => void;
  taskPriority: string; setTaskPriority: (v: string) => void;
  taskAssignedTo: string; setTaskAssignedTo: (v: string) => void;
  taskSprintId: string; setTaskSprintId: (v: string) => void;
  taskEstimatedHours: string; setTaskEstimatedHours: (v: string) => void;
  taskDueDate: string; setTaskDueDate: (v: string) => void;
  taskClientVisible: boolean; setTaskClientVisible: (v: boolean) => void;
  
  editTaskTitle: string; setEditTaskTitle: (v: string) => void;
  editTaskDescription: string; setEditTaskDescription: (v: string) => void;
  editTaskPriority: string; setEditTaskPriority: (v: string) => void;
  editTaskAssignedTo: string; setEditTaskAssignedTo: (v: string) => void;
  editTaskSprintId: string; setEditTaskSprintId: (v: string) => void;
  editTaskEstimatedHours: string; setEditTaskEstimatedHours: (v: string) => void;
  editTaskDueDate: string; setEditTaskDueDate: (v: string) => void;
  editTaskClientVisible: boolean; setEditTaskClientVisible: (v: boolean) => void;
  
  descExpanded: boolean; setDescExpanded: (v: boolean) => void;
  csvRows: any[]; setCsvRows: (rows: any[]) => void;
  csvFileName: string; setCsvFileName: (name: string) => void;
  uploading: boolean; setUploading: (u: boolean) => void;
  replaceDuplicates: boolean; setReplaceDuplicates: (r: boolean) => void;
  
  handleCreateTask: (e: React.FormEvent) => void;
  handleEditTaskSave: (e: React.FormEvent) => void;
  handleBulkUpload: () => void;
  handleCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleFlag?: (taskId: string, current: boolean) => void;
  openEditTask: (task: any) => void;
  
  members: any[];
  sprints: any[];
  phases: any[];
  taskTypes?: any[];
  workflowStatuses: any[];
  profile: any;
  isAdmin: boolean;
  isClient: boolean;
  PRIORITY_COLORS: Record<string, string>;
  doneStatusIds: string[];
  tasks?: any[];
  project?: any;
  viewCommentsData?: any[];
  viewCommentsLoadingData?: boolean;
  viewDepsData?: any[];
  viewDepsLoadingData?: boolean;
  viewBlockersData?: any[];
  viewBlockersLoadingData?: boolean;
  queryClient?: { invalidateQueries: (arg: any) => void };
  checkAndTriggerBlockerAlert?: (
    taskId: string,
    title: string,
    actionType?: "status" | "assignee" | "drag" | "log"
  ) => Promise<boolean>;
}

export function TaskModals(props: TaskModalsProps) {
  const statusColor = (statusId: string | null) => {
    if (!statusId) return "";
    return getStatusColor(props.workflowStatuses || [], statusId);
  };
  const getAvatarUrl = (name: string) => name ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}` : "";

  // Task Detail Dialog States
  const [viewCommentsLoading, setViewCommentsLoading] = useState(false);
  const [viewComments, setViewComments] = useState<any[]>([]);
  const [newViewComment, setNewViewComment] = useState("");

  const [viewDepsLoading, setViewDepsLoading] = useState(false);
  const [viewDeps, setViewDeps] = useState<any[]>([]);
  const [viewAddDepOpen, setViewAddDepOpen] = useState(false);
  const [viewAddDepTaskId, setViewAddDepTaskId] = useState("");
  const [viewAddDepType, setViewAddDepType] = useState("finish_to_start");
  const [confirmDepDelId, setConfirmDepDelId] = useState<string | null>(null);
  const [confirmDepDelTaskId, setConfirmDepDelTaskId] = useState<string | null>(null);

  const [viewBlockersLoading, setViewBlockersLoading] = useState(false);
  const [viewBlockers, setViewBlockers] = useState<any[]>([]);
  const [showViewAddBlocker, setShowViewAddBlocker] = useState(false);
  const [newViewBlockerDescription, setNewViewBlockerDescription] = useState("");
  const [newBlockerVisibility, setNewBlockerVisibility] = useState<"all" | "team">("all");
  const [newBlockerAssignType, setNewBlockerAssignType] = useState<"employee" | "client">("employee");
  const [newBlockerAssignUserId, setNewBlockerAssignUserId] = useState("");

  const [workflowTransitions, setWorkflowTransitions] = useState<any[]>([]);
  const [viewDependencyWarning, setViewDependencyWarning] = useState("");
  const [currentUserProjectRoleId, setCurrentUserProjectRoleId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!props.viewTaskData) return;
    let isMounted = true;
    const loadTransitions = async () => {
      const projId = props.viewTaskData.project_id;
      let templateId: string | null = null;
      if (projId) {
        const { data: proj } = await supabase
          .from("projects")
          .select("workflow_template_id")
          .eq("id", projId)
          .maybeSingle();
        templateId = proj?.workflow_template_id || null;
      }

      let query = supabase.from("workflow_transitions").select("*");
      if (templateId) {
        query = query.eq("workflow_template_id", templateId);
      }
      const { data: trans } = await query;
      if (isMounted && trans) {
        setWorkflowTransitions(trans);
      }
    };
    loadTransitions();
    return () => {
      isMounted = false;
    };
  }, [props.viewTaskData?.id, props.viewTaskData?.project_id]);

  React.useEffect(() => {
    if (props.viewCommentsData !== undefined) setViewComments(props.viewCommentsData);
    if (props.viewCommentsLoadingData !== undefined) setViewCommentsLoading(props.viewCommentsLoadingData);
  }, [props.viewTaskData?.id, props.viewCommentsData, props.viewCommentsLoadingData]);

  React.useEffect(() => {
    if (props.viewDepsData !== undefined) setViewDeps(props.viewDepsData);
    if (props.viewDepsLoadingData !== undefined) setViewDepsLoading(props.viewDepsLoadingData);
  }, [props.viewTaskData?.id, props.viewDepsData, props.viewDepsLoadingData]);

  React.useEffect(() => {
    if (props.viewBlockersData !== undefined) setViewBlockers(props.viewBlockersData);
    if (props.viewBlockersLoadingData !== undefined) setViewBlockersLoading(props.viewBlockersLoadingData);
  }, [props.viewTaskData?.id, props.viewBlockersData, props.viewBlockersLoadingData]);

  const resourceMembers = (props.members || []).map((m: any) => m.users).filter(Boolean);

  const addViewComment = () => {
    if (!newViewComment.trim()) return;
    setViewComments([...viewComments, { id: Date.now().toString(), body: newViewComment, created_at: new Date().toISOString(), author: props.profile }]);
    setNewViewComment("");
  };

  const addViewDependency = () => {
    if (!viewAddDepTaskId) return;
    const depTask = (props.tasks || []).find((t: any) => t.id === viewAddDepTaskId);
    setViewDeps([...viewDeps, { id: Date.now().toString(), dependency_type: viewAddDepType, depends_on: depTask }]);
    setViewAddDepOpen(false);
    setViewAddDepTaskId("");
  };

  const queryClient = props.queryClient || { invalidateQueries: (_arg: any) => {} };

  const addViewBlocker = async () => {
    const task = props.viewTaskData;
    const profile = props.profile;
    if (!newViewBlockerDescription.trim() || !task?.id || !profile?.id) return;
    const projectId = task.project_id || props.project?.id;
    if (!projectId) {
      toast.error("Missing project for this task");
      return;
    }

    const clientVisible = newBlockerVisibility === "all";
    const description = newViewBlockerDescription.trim();

    // Columns must match live task_blockers schema (no title / requires_client_action).
    const { data: blocker, error } = await supabase
      .from("task_blockers")
      .insert({
        project_id: projectId,
        task_id: task.id,
        description,
        raised_by: profile.id,
        client_visible: clientVisible,
      })
      .select("*, raiser:users!task_blockers_raised_by_fkey(full_name)")
      .single();

    if (error || !blocker) {
      toast.error(error?.message || "Failed to create blocker");
      return;
    }

    if (newBlockerAssignUserId) {
      const { error: actionError } = await supabase.from("client_action_items").insert({
        project_id: projectId,
        title: `Resolve Blocker: ${description}`,
        description: null,
        status: "pending",
        priority: "medium",
        requested_by: profile.id,
        assigned_to: newBlockerAssignUserId,
        blocker_id: blocker.id,
        visible_to_client: clientVisible,
      } as any);

      if (actionError) {
        toast.error(actionError.message);
      } else {
        toast.success("Blocker reported");
      }
    } else {
      toast.success("Blocker reported");
    }

    setViewBlockers([blocker, ...viewBlockers]);
    setShowViewAddBlocker(false);
    setNewViewBlockerDescription("");
    setNewBlockerVisibility("all");
    setNewBlockerAssignType("employee");
    setNewBlockerAssignUserId("");

    queryClient.invalidateQueries({ queryKey: ["task-blockers-view", task.id] });
    queryClient.invalidateQueries({ queryKey: ["project-blockers-all", projectId] });
    queryClient.invalidateQueries({ queryKey: ["client-sidebar-nav-counts", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-action-items", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
  };

  const resolveBlocker = async (blockerId: string, taskId?: string) => {
    const profile = props.profile;
    if (!profile?.id) return;
    const projectId = props.viewTaskData?.project_id || props.project?.id || "";

    const { error: rpcErr } = await supabase.rpc("resolve_blocker_cascade", {
      p_blocker_id: blockerId,
      p_resolved_by: profile.id,
    });

    if (rpcErr) {
      const { error } = await supabase
        .from("task_blockers")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
        })
        .eq("id", blockerId);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    toast.success("Blocker resolved");
    setViewBlockers(
      viewBlockers.map((b: any) =>
        b.id === blockerId
          ? { ...b, status: "resolved", resolved_at: new Date().toISOString(), resolver: profile }
          : b
      )
    );

    if (taskId) {
      queryClient.invalidateQueries({ queryKey: ["task-blockers-view", taskId] });
    }
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ["project-blockers-all", projectId] });
      queryClient.invalidateQueries({ queryKey: ["client-sidebar-nav-counts", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-action-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    }
  };

  const checkAndTriggerBlockerAlert =
    props.checkAndTriggerBlockerAlert ||
    (async (_taskId: string, _title: string, _type?: string) => false);
  const isDependencyWarnTarget = (_category: string) => false;
  const getUnfinishedDependencies = async (_taskId: string, _statuses: any[]) => [];
  const id = props.viewTaskData?.project_id || "";

  const {
    addTaskOpen, setAddTaskOpen,
    bulkTaskOpen, setBulkTaskOpen,
    editTaskOpen, setEditTaskOpen,
    viewTaskData, setViewTaskData,
    taskTitle, setTaskTitle,
    taskDescription, setTaskDescription,
    taskPriority, setTaskPriority,
    taskAssignedTo, setTaskAssignedTo,
    taskSprintId, setTaskSprintId,
    taskEstimatedHours, setTaskEstimatedHours,
    taskDueDate, setTaskDueDate,
    taskClientVisible, setTaskClientVisible,
    editTaskTitle, setEditTaskTitle,
    editTaskDescription, setEditTaskDescription,
    editTaskPriority, setEditTaskPriority,
    editTaskAssignedTo, setEditTaskAssignedTo,
    editTaskSprintId, setEditTaskSprintId,
    editTaskEstimatedHours, setEditTaskEstimatedHours,
    editTaskDueDate, setEditTaskDueDate,
    editTaskClientVisible, setEditTaskClientVisible,
    descExpanded, setDescExpanded,
    csvRows, setCsvRows,
    csvFileName, setCsvFileName,
    uploading, setUploading,
    replaceDuplicates, setReplaceDuplicates,
    handleCreateTask, handleEditTaskSave, handleBulkUpload, handleCSVUpload,
    toggleFlag, openEditTask,
    members, sprints, phases, taskTypes, workflowStatuses,
    profile, isAdmin, isClient, PRIORITY_COLORS, doneStatusIds, tasks, project
  } = props;
  const [taskDateOpen, setTaskDateOpen] = useState(false);
  const [editTaskDateOpen, setEditTaskDateOpen] = useState(false);

  const getInitials = (name: string) =>
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const clientStatusInfo = viewTaskData?.status_id
    ? getStatusDisplay(workflowStatuses || [], viewTaskData.status_id)
    : undefined;
  const clientBucket = bucketTaskState(clientStatusInfo);
  const clientProgress = PROGRESS_BY_BUCKET[clientBucket];
  const clientOwnerName = viewTaskData?.users?.full_name || "Unassigned";
  const clientSprintName = viewTaskData?.sprint_id
    ? sprints.find((sp: any) => sp.id === viewTaskData.sprint_id)?.name || "Unassigned"
    : "Unassigned";
  const clientShortId = (viewTaskData?.id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "???";
  const clientActivity = (() => {
    if (!viewTaskData) return [] as { text: string; time: string; primary?: boolean }[];
    const items: { text: string; time: string; primary?: boolean }[] = [];
    if (viewTaskData.created_at) {
      items.push({
        text: "Task created",
        time: format(new Date(viewTaskData.created_at), "MMM d, h:mm a"),
        primary: true,
      });
    }
    if (viewTaskData.status_id) {
      items.push({
        text: `Status set to ${clientBucket}`,
        time: viewTaskData.updated_at
          ? format(new Date(viewTaskData.updated_at), "MMM d, h:mm a")
          : "",
      });
    }
    viewComments.forEach((c: any) => {
      items.push({
        text: `${c.author?.full_name || (c.author_type === "ai" ? "AI" : "Someone")} commented`,
        time: c.created_at ? format(new Date(c.created_at), "MMM d, h:mm a") : "",
      });
    });
    return items;
  })();

  return (
    <>
      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Optional description" rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority *</label>
              <Select value={taskPriority} onValueChange={setTaskPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Time (hours)</label>
              <Input type="number" step="0.1" min="0" value={taskEstimatedHours} onChange={(e) => setTaskEstimatedHours(e.target.value)} placeholder="e.g. 1.5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Popover open={taskDateOpen} onOpenChange={setTaskDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskDueDate && "text-muted-foreground")}>
                    {taskDueDate ? format(new Date(taskDueDate + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={taskDueDate ? new Date(taskDueDate + "T00:00:00") : undefined} onSelect={(d) => { setTaskDueDate(d ? format(d, "yyyy-MM-dd") : ""); setTaskDateOpen(false); }} initialFocus />
                </PopoverContent>
              </Popover>
              {taskDueDate && <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setTaskDueDate("")}>Clear</button>}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="task-client-visible" checked={taskClientVisible} onCheckedChange={(v) => setTaskClientVisible(v === true)} />
              <label htmlFor="task-client-visible" className="text-sm font-medium cursor-pointer">Visible to client</label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign To</label>
              <Select value={taskAssignedTo} onValueChange={setTaskAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {members?.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {(m as any).users?.full_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint</label>
              <Select value={taskSprintId || "__backlog__"} onValueChange={(v) => setTaskSprintId(v === "__backlog__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Backlog" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__backlog__">Backlog</SelectItem>
                  {sprints.filter((s: any) => s.status !== "completed").map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Create Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Tasks Dialog */}
      <Dialog open={bulkTaskOpen} onOpenChange={(open) => { if (!uploading) setBulkTaskOpen(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Add Tasks</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">CSV Format</p>
                <Button type="button" variant="outline" size="sm" className="rounded-button" onClick={() => {
                  const sample = "title,description,priority,estimated_hours,due_date,client_visible,assigned_to\nDesign login page,Create mockups for the login screen,high,8,2025-09-01,true,\nAPI integration,Integrate REST API endpoints,medium,,2025-09-15,false,John Doe\nBug fix,Fix sidebar rendering issue,low,2,2025-08-20,true,";
                  const blob = new Blob([sample], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "task-import-template.csv"; a.click(); URL.revokeObjectURL(url);
                }}><Download className="h-4 w-4 mr-1" />Download Template</Button>
              </div>
              <p className="text-xs text-muted-foreground">Your CSV must have these column headers on the first row:</p>
              <div className="bg-muted rounded p-2 text-xs font-mono">title,description,priority,estimated_hours,due_date,client_visible,assigned_to</div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                <li><strong>title</strong> — required</li>
                <li><strong>description</strong> — optional</li>
                <li><strong>priority</strong> — must be one of: high, medium, low (case-insensitive, defaults to medium)</li>
                <li><strong>estimated_hours</strong> — optional decimal number (e.g. 1, 1.5, 2.25)</li>
                <li><strong>due_date</strong> — optional date (YYYY-MM-DD)</li>
                <li><strong>client_visible</strong> — optional, true/false/yes/no (defaults to true)</li>
                <li><strong>assigned_to</strong> — optional, employee full name (e.g. "John Doe"); left blank if no match found</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">All uploaded tasks will have status <strong>Unlinked</strong> and be assigned to this project.</p>
            </Card>

            <div className="space-y-2">
              <label className="text-sm font-medium">Upload CSV</label>
              <Input type="file" accept=".csv" onChange={handleCSVUpload} className="h-9" />
              {csvFileName && <p className="text-xs text-muted-foreground">File: {csvFileName}</p>}
            </div>

            {csvRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Preview ({csvRows.length} row{csvRows.length !== 1 ? "s" : ""})</p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={replaceDuplicates} onChange={(e) => setReplaceDuplicates(e.target.checked)} className="rounded" />
                    Replace existing tasks (matched by title)
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const newCount = csvRows.filter(r => !r.isDuplicate).length;
                    const dupCount = csvRows.filter(r => r.isDuplicate).length;
                    const validNew = csvRows.filter(r => !r.isDuplicate && r.errors.length === 0).length;
                    const parts = [`${validNew} new`];
                    if (dupCount > 0) parts.push(`${dupCount} duplicate${dupCount !== 1 ? "s" : ""} (${replaceDuplicates ? "will replace" : "skipped"})`);
                    return parts.join(", ");
                  })()}
                </p>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium">#</th>
                        <th className="text-left p-2 font-medium">Title</th>
                        <th className="text-left p-2 font-medium">Description</th>
                        <th className="text-left p-2 font-medium">Priority</th>
                        <th className="text-left p-2 font-medium">Est. Hours</th>
                        <th className="text-left p-2 font-medium">Due Date</th>
                        <th className="text-left p-2 font-medium">Visible</th>
                        <th className="text-left p-2 font-medium">Assigned To</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r) => (
                        <tr key={r.rowNum} className={r.isDuplicate ? "bg-orange-50" : r.errors.length > 0 ? "bg-red-50" : "border-t"}>
                          <td className="p-2 break-words text-muted-foreground">{r.rowNum}</td>
                          <td className={`p-2 break-words font-medium ${!r.title ? "text-red-500" : ""}`}>{r.title || <span className="italic text-red-400">empty</span>}</td>
                          <td className="p-2 break-words text-muted-foreground">{truncateWords(r.description, 4) || "—"}</td>
                          <td className="p-2 break-words">
                            <Badge className={PRIORITY_COLORS[r.priority] || ""}>{r.priority}</Badge>
                          </td>
                          <td className="p-2 break-words text-muted-foreground">{r.estimated_hours || "—"}</td>
                          <td className="p-2 break-words text-muted-foreground">{r.due_date || "—"}</td>
                          <td className="p-2 break-words">{r.client_visible && !["false", "no", "0"].includes(r.client_visible) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}</td>
                          <td className="p-2 break-words">
                            {r.assigned_to ? (
                              r.resolvedId ? (
                                <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{r.assigned_to}</span>
                              ) : (
                                <span className="text-red-500 flex items-center gap-1"><XCircle className="h-3 w-3" />{r.assigned_to}</span>
                              )
                            ) : "—"}
                          </td>
                          <td className="p-2 break-words">
                            {r.isDuplicate && <Badge className="bg-orange-100 text-orange-800 text-[10px]">Duplicate</Badge>}
                          </td>
                          <td className="p-2 break-words">
                            {r.errors.length > 0 ? (
                              <span className="text-red-500 text-[10px]">{r.errors.join("; ")}</span>
                            ) : (
                              <span className="text-green-500">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setBulkTaskOpen(false); setCsvRows([]); setCsvFileName(""); setReplaceDuplicates(false); }} disabled={uploading}>Cancel</Button>
            <Button type="button" onClick={handleBulkUpload} disabled={csvRows.length === 0 || uploading}>
              {uploading ? "Uploading..." : `Confirm Upload${csvRows.length > 0 ? ` (${csvRows.filter((r) => r.errors.length === 0 || r.errors.every((err) => err.startsWith("Invalid priority") || err.startsWith("Duplicate"))).length} rows)` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editTaskOpen} onOpenChange={setEditTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <form onSubmit={handleEditTaskSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} placeholder="Task title" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editTaskDescription} onChange={(e) => setEditTaskDescription(e.target.value)} placeholder="Optional description" rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority *</label>
              <Select value={editTaskPriority} onValueChange={setEditTaskPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Time (hours)</label>
              <Input type="number" min="0" step="0.5" value={editTaskEstimatedHours} onChange={(e) => setEditTaskEstimatedHours(e.target.value)} placeholder="e.g. 4" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Popover open={editTaskDateOpen} onOpenChange={setEditTaskDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editTaskDueDate && "text-muted-foreground")}>
                    {editTaskDueDate ? format(new Date(editTaskDueDate + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editTaskDueDate ? new Date(editTaskDueDate + "T00:00:00") : undefined} onSelect={(d) => { setEditTaskDueDate(d ? format(d, "yyyy-MM-dd") : ""); setEditTaskDateOpen(false); }} initialFocus />
                </PopoverContent>
              </Popover>
              {editTaskDueDate && <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditTaskDueDate("")}>Clear</button>}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="edit-task-client-visible" checked={editTaskClientVisible} onCheckedChange={(v) => setEditTaskClientVisible(v === true)} />
              <label htmlFor="edit-task-client-visible" className="text-sm font-medium cursor-pointer">Visible to client</label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign To</label>
              <Select value={editTaskAssignedTo} onValueChange={setEditTaskAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {members?.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {(m as any).users?.full_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint</label>
              <Select value={editTaskSprintId || "__backlog__"} onValueChange={(v) => setEditTaskSprintId(v === "__backlog__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Backlog" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__backlog__">Backlog</SelectItem>
                  {sprints.filter((s: any) => s.status !== "completed").map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Task Details Dialog */}
      <Dialog open={!!viewTaskData} onOpenChange={(open) => {
        if (!open) {
          setViewTaskData(null);
          setDescExpanded(false);
          setNewViewComment("");
          setShowViewAddBlocker(false);
          setNewViewBlockerDescription("");
          setNewBlockerVisibility("all");
          setNewBlockerAssignType("employee");
          setNewBlockerAssignUserId("");
          setViewAddDepOpen(false);
          setViewAddDepTaskId("");
          setViewAddDepType("finish_to_start");
        }
      }}>
        <DialogContent
          className={cn(
            isClient &&
              "flex flex-col !w-[min(1100px,calc(100vw-36px))] sm:!w-[min(1100px,calc(100vw-36px))] h-[min(860px,calc(100vh-36px))] max-w-none max-h-none p-0 gap-0 overflow-hidden rounded-2xl border-[#DCDCE1] shadow-[0_24px_72px_rgba(20,20,24,0.22)] [&>button.absolute]:hidden"
          )}
        >
          {isClient ? (
            <>
              <header className="flex-none px-[26px] pt-[22px] pb-0 bg-white border-b border-[#E8E8EB]">
                <div className="flex items-start gap-3.5">
                  <div className="w-[38px] h-[38px] rounded-[12px] bg-gradient-to-br from-[#FF7638] to-[#EB5A1E] text-white flex items-center justify-center shadow-[0_8px_18px_rgba(235,90,30,0.20)] shrink-0">
                    <Info className="h-4 w-4 text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-[0.055em] uppercase text-[#929299]">
                      TASK-{clientShortId} · {project?.name || "Project"}
                    </div>
                    <DialogTitle className="mt-1 pr-10 text-[23px] leading-[1.3] tracking-[-0.55px] font-bold text-[#17171A]">
                      {viewTaskData?.title || "Task Details"}
                    </DialogTitle>
                    <div className="flex flex-wrap gap-[7px] mt-[11px] pb-0">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold",
                          STATUS_PILL_CLASS[clientBucket]
                        )}
                      >
                        {clientBucket}
                      </span>
                      {viewTaskData?.priority && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold capitalize",
                            PRIORITY_PILL_CLASS[viewTaskData.priority] || "bg-[#F0F0F2] text-[#55555B]"
                          )}
                        >
                          {viewTaskData.priority}
                        </span>
                      )}
                      {clientSprintName !== "Unassigned" && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-[#DDEBFF] text-[#3873C9] text-[8px] font-semibold">
                          {clientSprintName}
                        </span>
                      )}
                      {viewTaskData?.is_flagged && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 bg-[#FDE1E1] text-[#D04A4A] text-[8.5px] font-semibold">
                          Flagged
                        </span>
                      )}
                      {(viewTaskData?.client_visible !== false) && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 bg-[#EAF1FF] text-[#3B68B5] text-[8.5px] font-semibold">
                          Client visible
                        </span>
                      )}
                    </div>
                  </div>
                  <DialogClose asChild>
                    <button
                      type="button"
                      aria-label="Close task details"
                      className="w-[34px] h-[34px] border border-[#E2E2E6] rounded-[9px] bg-white text-[#64646B] text-[20px] leading-none hover:bg-[#F5F5F7] hover:text-[#17171A] shrink-0 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </DialogClose>
                </div>

                <div className="mt-5 grid grid-cols-2 lg:grid-cols-[1.2fr_1.35fr_1fr_1fr_1.3fr] border-t border-[#ECECEF]">
                  <div className="py-3.5 pr-[18px] min-w-0 border-t border-[#ECECEF] lg:border-t-0 first:border-t-0">
                    <div className="text-[8.5px] font-semibold text-[#97979E] mb-[5px]">Owner</div>
                    <div className="flex items-center gap-[7px] text-[11px] font-semibold text-[#2B2B30] truncate">
                      <span className="w-[25px] h-[25px] rounded-[7px] bg-[#F0F0F2] text-[#4B4B52] flex items-center justify-center text-[7.5px] font-bold shrink-0">
                        {getInitials(clientOwnerName)}
                      </span>
                      <span className="truncate">{clientOwnerName}</span>
                    </div>
                  </div>
                  <div className="py-3.5 px-0 lg:pl-[18px] lg:pr-[18px] min-w-0 border-t border-[#ECECEF] lg:border-t-0 lg:border-l lg:border-[#ECECEF]">
                    <div className="text-[8.5px] font-semibold text-[#97979E] mb-[5px]">Sprint</div>
                    <div className="text-[11px] font-semibold text-[#2B2B30] truncate">{clientSprintName}</div>
                  </div>
                  <div className="py-3.5 px-0 lg:pl-[18px] lg:pr-[18px] min-w-0 border-t border-[#ECECEF] lg:border-t-0 lg:border-l lg:border-[#ECECEF]">
                    <div className="text-[8.5px] font-semibold text-[#97979E] mb-[5px]">Due date</div>
                    <div className="text-[11px] font-semibold text-[#2B2B30] truncate">
                      {viewTaskData?.due_date
                        ? format(new Date(viewTaskData.due_date + "T00:00:00"), "MMM d, yyyy")
                        : "Not set"}
                    </div>
                  </div>
                  <div className="py-3.5 px-0 lg:pl-[18px] lg:pr-[18px] min-w-0 border-t border-[#ECECEF] lg:border-t-0 lg:border-l lg:border-[#ECECEF]">
                    <div className="text-[8.5px] font-semibold text-[#97979E] mb-[5px]">Estimate</div>
                    <div className="text-[11px] font-semibold text-[#2B2B30] truncate">
                      {viewTaskData?.estimated_hours ? `${viewTaskData.estimated_hours}h` : "—"}
                    </div>
                  </div>
                  <div className="py-3.5 px-0 lg:pl-[18px] min-w-0 border-t border-[#ECECEF] lg:border-t-0 lg:border-l lg:border-[#ECECEF] col-span-2 lg:col-span-1">
                    <div className="text-[8.5px] font-semibold text-[#97979E] mb-[5px]">Progress</div>
                    <div className="flex items-center gap-2">
                      <div className="w-[78px] h-1.5 rounded-full bg-[#ECECEF] overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full bg-[#EB5A1E]"
                          style={{ width: `${clientProgress}%` }}
                        />
                      </div>
                      <div className="text-[11px] font-semibold text-[#2B2B30]">{clientProgress}%</div>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
                <main className="min-w-0 min-h-0 overflow-y-auto px-8 py-[25px] pb-[34px]">
                  {/* Overview */}
                  <section className="pb-[25px] mb-[25px] border-b border-[#ECECEF]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-[9px] text-[12px] font-bold text-[#242428]">
                        <span className="w-7 h-7 rounded-lg bg-[#FFF1EA] text-[#C95627] flex items-center justify-center shrink-0">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </span>
                        Overview
                      </div>
                    </div>
                    <div className="px-4 py-[15px] border border-[#E9E9EC] bg-[#FCFCFD] rounded-[11px] text-[11px] leading-[1.75] text-[#5E5E65] whitespace-pre-wrap">
                      {viewTaskData?.description || "No description provided for this task."}
                    </div>
                  </section>

                  {/* Acceptance criteria */}
                  <section className="pb-[25px] mb-[25px] border-b border-[#ECECEF]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-[9px] text-[12px] font-bold text-[#242428]">
                        <span className="w-7 h-7 rounded-lg bg-[#FFF1EA] text-[#C95627] flex items-center justify-center shrink-0">
                          <Info className="h-3.5 w-3.5" />
                        </span>
                        Acceptance criteria
                      </div>
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F1F1F3] text-[#6C6C73] text-[8px] font-bold inline-flex items-center justify-center">
                        0
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9A9AA0] leading-relaxed">
                      No acceptance criteria have been defined for this task yet.
                    </p>
                  </section>

                  {/* Delivery */}
                  <section className="pb-[25px] mb-[25px] border-b border-[#ECECEF]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-[9px] text-[12px] font-bold text-[#242428]">
                        <span className="w-7 h-7 rounded-lg bg-[#FFF1EA] text-[#C95627] flex items-center justify-center shrink-0">
                          <List className="h-3.5 w-3.5" />
                        </span>
                        Delivery
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="border border-[#E8E8EB] rounded-[11px] bg-white p-[13px] min-w-0">
                        <div className="flex items-center gap-2 text-[9.5px] font-bold text-[#414147] mb-2.5">
                          <List className="h-[13px] w-[13px] text-[#77777E]" /> Checklist
                        </div>
                        <p className="text-[9px] text-[#9A9AA0] leading-relaxed">
                          No checklist items for this task.
                        </p>
                      </div>
                      <div className="border border-[#E8E8EB] rounded-[11px] bg-white p-[13px] min-w-0">
                        <div className="flex items-center gap-2 text-[9.5px] font-bold text-[#414147] mb-2.5">
                          <Link2 className="h-[13px] w-[13px] text-[#77777E]" /> Dependencies
                        </div>
                        {viewDepsLoading ? (
                          <p className="text-[9px] text-[#9A9AA0]">Loading...</p>
                        ) : viewDeps.length === 0 ? (
                          <p className="text-[9px] text-[#9A9AA0] leading-relaxed">
                            No dependencies linked to this task.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {viewDeps.map((d: any) => (
                              <div key={d.id} className="flex items-start gap-2 min-w-0">
                                <span className="w-[7px] h-[7px] rounded-full bg-[#E1A52D] mt-1 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[9px] font-semibold text-[#4C4C53] leading-snug">
                                    {d.depends_on?.title || "Unknown"}
                                  </div>
                                  <div className="text-[8px] text-[#98989F] mt-0.5 leading-snug">
                                    {(d.dependency_type || "").replace(/_/g, " ")}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Discussion */}
                  <section className="pb-[25px] mb-[25px] border-b border-[#ECECEF]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-[9px] text-[12px] font-bold text-[#242428]">
                        <span className="w-7 h-7 rounded-lg bg-[#FFF1EA] text-[#C95627] flex items-center justify-center shrink-0">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </span>
                        Discussion
                      </div>
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F1F1F3] text-[#6C6C73] text-[8px] font-bold inline-flex items-center justify-center">
                        {viewComments.length}
                      </span>
                    </div>
                    <div className="border border-[#E8E8EB] rounded-[11px] overflow-hidden bg-white">
                      <div className="px-3.5">
                        {viewCommentsLoading ? (
                          <p className="text-[9px] text-[#9A9AA0] py-3.5">Loading...</p>
                        ) : viewComments.length === 0 ? (
                          <p className="text-[9px] text-[#9A9AA0] py-3.5">No comments yet.</p>
                        ) : (
                          viewComments.map((c: any) => {
                            const authorName =
                              c.author?.full_name ||
                              (c.author_type === "ai" ? "AI" : c.author_type === "system" ? "System" : "Unknown");
                            return (
                              <div
                                key={c.id}
                                className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 py-3.5 border-b border-[#EFEFF1] last:border-0"
                              >
                                <div className="w-[30px] h-[30px] rounded-lg bg-[#F0F0F2] text-[#4C4C53] flex items-center justify-center text-[8px] font-bold">
                                  {getInitials(authorName)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-[7px]">
                                    <span className="text-[9.5px] font-bold text-[#333338]">{authorName}</span>
                                    <span className="text-[8px] text-[#9A9AA1]">
                                      {c.created_at ? format(new Date(c.created_at), "MMM d, h:mm a") : ""}
                                    </span>
                                  </div>
                                  <p className="text-[9.5px] text-[#64646B] leading-[1.6] mt-[5px] whitespace-pre-wrap break-words">
                                    {c.body}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 px-3.5 py-3 bg-[#FAFAFB] border-t border-[#E9E9EC]">
                        <div className="w-[30px] h-[30px] rounded-lg bg-[#F0F0F2] text-[#4C4C53] flex items-center justify-center text-[8px] font-bold">
                          {getInitials(profile?.full_name || "CT")}
                        </div>
                        <div>
                          <textarea
                            value={newViewComment}
                            onChange={(e) => setNewViewComment(e.target.value)}
                            placeholder="Add a client-visible comment…"
                            className="w-full min-h-[64px] resize-y box-border border border-[#DCDCE1] rounded-[9px] bg-white outline-none px-[11px] py-2.5 text-[9.5px] text-[#333338] focus:border-[#B8B8BF]"
                          />
                          <div className="flex justify-end mt-[7px]">
                            <button
                              type="button"
                              disabled={!newViewComment.trim()}
                              onClick={addViewComment}
                              className="h-[30px] px-3 rounded-[7px] bg-[#17171A] text-white text-[8.5px] font-semibold disabled:bg-[#D7D7DC] disabled:cursor-not-allowed"
                            >
                              Send comment
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Activity */}
                  <section>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-[9px] text-[12px] font-bold text-[#242428]">
                        <span className="w-7 h-7 rounded-lg bg-[#FFF1EA] text-[#C95627] flex items-center justify-center shrink-0">
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </span>
                        Activity
                      </div>
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F1F1F3] text-[#6C6C73] text-[8px] font-bold inline-flex items-center justify-center">
                        {clientActivity.length}
                      </span>
                    </div>
                    {clientActivity.length === 0 ? (
                      <p className="text-[9px] text-[#9A9AA0]">No activity recorded for this task yet.</p>
                    ) : (
                      <div className="relative pl-0.5">
                        {clientActivity.map((a, idx) => (
                          <div
                            key={`${a.text}-${idx}`}
                            className={cn(
                              "grid grid-cols-[18px_minmax(0,1fr)_auto] gap-[9px] py-2 relative",
                              a.primary && "primary"
                            )}
                          >
                            {idx < clientActivity.length - 1 && (
                              <span className="absolute left-[6px] top-[19px] bottom-[-8px] w-px bg-[#E5E5E8]" />
                            )}
                            <span
                              className={cn(
                                "w-[13px] h-[13px] rounded-full bg-white border-2 border-[#C9C9CF] box-border z-[1] mt-0.5",
                                a.primary && "border-[#EB5A1E] bg-[#FFF1EA]"
                              )}
                            />
                            <span className="text-[9px] text-[#606067] leading-[1.5]">{a.text}</span>
                            <span className="text-[8px] text-[#A0A0A7] whitespace-nowrap">{a.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </main>

                <aside className="min-w-0 min-h-0 overflow-y-auto px-5 py-[22px] pb-[30px] bg-[#FAFAFB] border-t lg:border-t-0 lg:border-l border-[#E8E8EB]">
                  {/* Properties */}
                  <section className="mb-[21px] pb-5 border-b border-[#E7E7EA]">
                    <div className="text-[8px] font-extrabold tracking-[0.075em] uppercase text-[#96969D] mb-[9px]">
                      Properties
                    </div>
                    <div className="border border-[#E5E5E8] rounded-[10px] overflow-hidden bg-white">
                      {[
                        { label: "Status", value: clientBucket },
                        {
                          label: "Priority",
                          value: viewTaskData?.priority
                            ? String(viewTaskData.priority).charAt(0).toUpperCase() +
                              String(viewTaskData.priority).slice(1)
                            : "—",
                        },
                        { label: "Task type", value: "—" },
                        { label: "Component", value: "—" },
                        { label: "Milestone", value: "—" },
                        { label: "Reference", value: "—" },
                        {
                          label: "Created",
                          value: viewTaskData?.created_at
                            ? format(new Date(viewTaskData.created_at), "MMM d, yyyy")
                            : "—",
                        },
                        {
                          label: "Updated",
                          value: viewTaskData?.updated_at
                            ? format(new Date(viewTaskData.updated_at), "MMM d, yyyy")
                            : "—",
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-[92px_minmax(0,1fr)] gap-2.5 items-center min-h-[38px] px-2.5 py-[7px] border-b border-[#EFEFF1] last:border-0"
                        >
                          <span className="text-[8px] text-[#96969D]">{row.label}</span>
                          <span className="text-[8.8px] font-semibold text-[#404046] truncate" title={row.value}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* People */}
                  <section className="mb-[21px] pb-5 border-b border-[#E7E7EA]">
                    <div className="text-[8px] font-extrabold tracking-[0.075em] uppercase text-[#96969D] mb-[9px]">
                      People
                    </div>
                    <div className="flex flex-col gap-2">
                      {viewTaskData?.users?.full_name ? (
                        <div className="flex items-center gap-[9px] p-[9px] border border-[#E7E7EA] rounded-[9px] bg-white">
                          <div className="w-7 h-7 rounded-lg bg-[#F0F0F2] text-[#48484F] flex items-center justify-center text-[7.5px] font-bold shrink-0">
                            {getInitials(viewTaskData.users.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[8.8px] font-bold text-[#414147] truncate">
                              {viewTaskData.users.full_name}
                            </div>
                            <div className="text-[7.8px] text-[#9999A0] mt-px">Owner</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[9px] text-[#9A9AA0]">No owner assigned.</p>
                      )}
                    </div>
                  </section>

                  {/* Blockers */}
                  <section className="mb-[21px] pb-5 border-b border-[#E7E7EA]">
                    <div className="text-[8px] font-extrabold tracking-[0.075em] uppercase text-[#96969D] mb-[9px]">
                      Blockers
                    </div>
                    {viewBlockersLoading ? (
                      <p className="text-[9px] text-[#9A9AA0]">Loading...</p>
                    ) : viewBlockers.length === 0 ? (
                      <div className="p-[9px] border border-[#E7E7EA] rounded-[9px] bg-white">
                        <div className="text-[8.5px] font-semibold text-[#48484F] leading-snug">
                          No active blockers
                        </div>
                        <div className="text-[7.6px] text-[#9999A0] mt-[3px]">
                          Nothing is currently preventing this task from progressing.
                        </div>
                      </div>
                    ) : (
                      viewBlockers.map((b: any) => (
                        <div
                          key={b.id}
                          className="p-[9px] border border-[#E7E7EA] rounded-[9px] bg-white mb-[7px] last:mb-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[8.5px] font-semibold text-[#48484F] leading-snug">
                              {b.description}
                            </div>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[7.5px] font-semibold shrink-0",
                                b.status === "resolved"
                                  ? "bg-[#E5F7EA] text-[#188344]"
                                  : "bg-[#FFF4D8] text-[#8F6811]"
                              )}
                            >
                              {b.status === "resolved" ? "Resolved" : "Open"}
                            </span>
                          </div>
                          <div className="text-[7.6px] text-[#9999A0] mt-[3px]">
                            by {b.raiser?.full_name || "Unknown"}
                            {b.raised_at ? ` · ${format(new Date(b.raised_at), "MMM d")}` : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  {/* Attachments */}
                  <section className="mb-[21px] pb-5 border-b border-[#E7E7EA]">
                    <div className="text-[8px] font-extrabold tracking-[0.075em] uppercase text-[#96969D] mb-[9px]">
                      Attachments
                    </div>
                    <p className="text-[9px] text-[#9A9AA0]">No attachments yet.</p>
                  </section>

                  {/* Labels */}
                  <section>
                    <div className="text-[8px] font-extrabold tracking-[0.075em] uppercase text-[#96969D] mb-[9px]">
                      Labels
                    </div>
                    <p className="text-[9px] text-[#9A9AA0]">No labels.</p>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTaskData?.title || "Task Details"}
              {viewTaskData?.is_flagged && <Flag className="h-4 w-4 text-red-500 shrink-0" />}
            </DialogTitle>
            {viewTaskData?.description && (
              <div className="mt-1">
                <p className="text-sm text-muted-foreground">{descExpanded ? viewTaskData.description : truncateWords(viewTaskData.description, 4)}</p>
                {viewTaskData.description.split(/\s+/).length > 4 && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground" onClick={() => setDescExpanded(!descExpanded)}>
                    {descExpanded ? "Show less" : "Show more"}
                  </Button>
                )}
              </div>
            )}
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mt-2">
            {viewTaskData?.priority && <Badge className={PRIORITY_COLORS[viewTaskData.priority] || ""}>{viewTaskData.priority}</Badge>}
            {viewTaskData?.status_id && <Badge className={statusColor(viewTaskData.status_id) || ""}>{getStatusDisplay(workflowStatuses || [], viewTaskData.status_id).name}</Badge>}
            {viewTaskData?.estimated_hours && <span className="text-xs text-muted-foreground">{viewTaskData.estimated_hours}h est.</span>}
            {viewTaskData?.due_date && <span className="text-xs text-muted-foreground">Due {format(new Date(viewTaskData.due_date + "T00:00:00"), "MMM d")}</span>}
            {viewTaskData?.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === viewTaskData.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.name}</Badge> : null; })()}
          </div>

          <Separator className="my-4" />

          {/* Collaborators */}
          {viewTaskData?.id && (
            <>
              <TaskCollaboratorsSection
                taskId={viewTaskData.id}
                projectMembers={resourceMembers}
                primaryOwnerId={viewTaskData.assigned_to}
                readOnly={isClient}
              />
              <Separator className="my-4" />
            </>
          )}

          {/* Comments */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</h4>
            {viewCommentsLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : viewComments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {viewComments.map((c: any) => (
                  <div key={c.id} className="flex gap-2 bg-muted/30 rounded-md p-2.5">
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarImage src={getAvatarUrl(c.author?.full_name)} />
                      <AvatarFallback className="text-[10px]">{c.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{c.author?.full_name || (c.author_type === "ai" ? "AI" : c.author_type === "system" ? "System" : "Unknown")}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isClient && (
            <div className="flex gap-2">
              <Textarea
                value={newViewComment}
                onChange={(e) => setNewViewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="text-sm resize-none"
              />
              <Button type="button" size="sm" onClick={addViewComment} disabled={!newViewComment.trim()} className="shrink-0 self-end">Comment</Button>
            </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Dependencies */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg> Dependencies</h4>
            {viewDepsLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : viewDeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dependencies.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {viewDeps.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between bg-muted/30 rounded-md p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{d.depends_on?.title || "Unknown"}</span>
                      <Badge variant="outline" className="text-[10px]">{d.dependency_type.replace(/_/g, " ")}</Badge>
                    </div>
                    {!isClient && (
                    <button
                      type="button"
                      onClick={() => { setConfirmDepDelId(d.id); setConfirmDepDelTaskId(viewTaskData?.id); }}
                      className="shrink-0 p-1 rounded hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600"
                      title="Remove dependency"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!isClient && (viewAddDepOpen ? (
              <div className="space-y-2 border rounded-md p-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Depends on</label>
                  <Select value={viewAddDepTaskId} onValueChange={setViewAddDepTaskId}>
                    <SelectTrigger><SelectValue placeholder="Select task..." /></SelectTrigger>
                    <SelectContent>
                      {(tasks || [])
                        .filter((t: any) => t.id !== viewTaskData?.id && !(t.status_id && doneStatusIds.has(t.status_id)) && t.assigned_to !== profile?.id)
                        .map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2">
                              <span>{t.title}</span>
                              <span className="text-xs text-muted-foreground">— {t.users?.full_name || "Unassigned"}</span>
                              <Badge className={`text-[10px] ${statusColor(t.status_id) || ""}`}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Dependency type</label>
                  <Select value={viewAddDepType} onValueChange={setViewAddDepType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finish_to_start">Finish → Start</SelectItem>
                      <SelectItem value="start_to_start">Start → Start</SelectItem>
                      <SelectItem value="finish_to_finish">Finish → Finish</SelectItem>
                      <SelectItem value="start_to_finish">Start → Finish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={addViewDependency} disabled={!viewAddDepTaskId}>Add</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setViewAddDepOpen(false); setViewAddDepTaskId(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setViewAddDepOpen(true)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Dependency
              </Button>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Blockers */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Blockers</h4>
            {viewBlockersLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : viewBlockers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No blockers reported.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {viewBlockers.map((b: any) => (
                  <div key={b.id} className="flex items-start justify-between gap-2 bg-muted/30 rounded-md p-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{b.description}</span>
                        {b.status === "resolved" ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px]">Resolved</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">Open</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">by {b.raiser?.full_name || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(b.raised_at), "MMM d")}</span>
                        {b.status === "resolved" && b.resolver && (
                          <span className="text-[10px] text-muted-foreground">· resolved by {b.resolver.full_name}</span>
                        )}
                      </div>
                    </div>
                    {b.status !== "resolved" && !isClient && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => resolveBlocker(b.id, viewTaskData?.id)} className="shrink-0 h-7 px-2" title="Resolve">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!isClient && (showViewAddBlocker ? (
              <div className="space-y-3 border rounded-md p-3">
                <Textarea value={newViewBlockerDescription} onChange={(e) => setNewViewBlockerDescription(e.target.value)} placeholder="Describe the blocker..." rows={2} className="text-sm resize-none" />
                <div className="space-y-1">
                  <label className="text-xs font-medium">Visibility</label>
                  <Select value={newBlockerVisibility} onValueChange={(v: "all" | "team") => setNewBlockerVisibility(v)}>
                    <SelectTrigger className="w-full h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">View To All</SelectItem>
                      <SelectItem value="team">View To Team Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Assign To</label>
                  <Select value={newBlockerAssignType} onValueChange={(v: "employee" | "client") => { setNewBlockerAssignType(v); setNewBlockerAssignUserId(""); }}>
                    <SelectTrigger className="w-full h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{newBlockerAssignType === "employee" ? "Select Employee" : "Select Client Member"}</label>
                  <Select value={newBlockerAssignUserId} onValueChange={setNewBlockerAssignUserId}>
                    <SelectTrigger className="w-full h-8 text-sm"><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      {(members || [])
                        .filter((m: any) => {
                          if (newBlockerAssignType === "employee") return m.users?.role === "employee";
                          return m.users?.role === "client member";
                        })
                        .map((m: any) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={addViewBlocker} disabled={!newViewBlockerDescription.trim() || !newBlockerAssignUserId}>Add</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowViewAddBlocker(false); setNewViewBlockerDescription(""); setNewBlockerVisibility("all"); setNewBlockerAssignType("employee"); setNewBlockerAssignUserId(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowViewAddBlocker(true)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Report Blocker
              </Button>
            ))}
          </div>

          {(viewTaskData?.assigned_to === profile?.id || isAdmin || viewTaskData?.created_by === profile?.id) && viewTaskData?.status_id && workflowStatuses && !isClient && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightCircle className="h-4 w-4 text-primary" /> Task Stage & Workflow
                </h4>
                <StageOutcomeSelector
                  taskId={viewTaskData.id}
                  currentStatusId={viewTaskData.status_id}
                  workflowStatuses={workflowStatuses}
                  transitions={workflowTransitions}
                  onDeclare={async (toStatusId) => {
                    const isBlocked = await checkAndTriggerBlockerAlert(viewTaskData.id, viewTaskData.title, "status");
                    if (isBlocked) return;
                    const { error } = await supabase.rpc("declare_stage_outcome", {
                      p_task_id: viewTaskData.id,
                      p_to_status_id: toStatusId,
                      p_changed_by_type: isAdmin ? "admin" : "employee",
                    });
                    if (error) {
                      toast.error(`Could not move task: ${error.message}`);
                      if (error.message.toLowerCase().includes("blocker")) {
                        await checkAndTriggerBlockerAlert(viewTaskData.id, viewTaskData.title, "status");
                      }
                      return;
                    }
                    toast.success("Task status updated successfully!");
                    const { data: updated } = await supabase.from("tasks").select("*").eq("id", viewTaskData.id).single();
                    if (updated) setViewTaskData(updated);
                    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
                  }}
                  onTargetChange={(toStatusId) => {
                    if (!toStatusId) {
                      setViewDependencyWarning("");
                      return;
                    }
                    const target = workflowStatuses.find((s: any) => s.id === toStatusId);
                    if (!target || !isDependencyWarnTarget(target.category)) {
                      setViewDependencyWarning("");
                      return;
                    }
                    getUnfinishedDependencies(viewTaskData.id, workflowStatuses).then((deps) => {
                      setViewDependencyWarning(
                        deps.length > 0 ? `Unfinished dependencies: ${deps.map((d) => d.title).join(", ")}` : ""
                      );
                    });
                  }}
                  compact
                  userRoleId={currentUserProjectRoleId ?? null}
                  isSystemAdmin={isAdmin}
                />
                {viewDependencyWarning && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                    <span className="font-medium">⚠ {viewDependencyWarning}</span>
                  </div>
                )}
              </div>
            </>
          )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
