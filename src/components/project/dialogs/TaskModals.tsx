import { TaskCollaboratorsSection } from "@/components/TaskCollaboratorsSection";
import { StageOutcomeSelector } from "@/components/StageOutcomeSelector";
import { getStatusDisplay, getStatusColor } from "@/lib/workflow";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Flag, Paperclip, Send, Trash2, Download, Upload, FileText, CheckCircle2, Clock, AlertCircle, Calendar as CalendarIcon, MessageSquare, Plus, Search, Eye, EyeOff, XCircle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { truncateWords, cn } from "@/lib/utils";

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
  taskDescription: string;
  setTaskDescription: (v: string) => void;
  taskPriority: string; setTaskPriority: (v: string) => void;
  taskAssignedTo: string; setTaskAssignedTo: (v: string) => void;
  taskSprintId: string; setTaskSprintId: (v: string) => void;
taskEstimatedHours: string; setTaskEstimatedHours: (v: string) => void;
  taskDueDate: string;
  setTaskDueDate: (v: string) => void;
taskClientVisible: boolean;
  setTaskClientVisible: (v: boolean) => void;
  
  editTaskTitle: string; setEditTaskTitle: (v: string) => void;
  editTaskDescription: string;
  setEditTaskDescription: (v: string) => void;
  editTaskPriority: string; setEditTaskPriority: (v: string) => void;
  editTaskAssignedTo: string; setEditTaskAssignedTo: (v: string) => void;
  editTaskSprintId: string; setEditTaskSprintId: (v: string) => void;
editTaskEstimatedHours: string; setEditTaskEstimatedHours: (v: string) => void;
  editTaskDueDate: string;
  setEditTaskDueDate: (v: string) => void;
editTaskClientVisible: boolean;
  setEditTaskClientVisible: (v: boolean) => void;
  
  descExpanded: boolean; setDescExpanded: (v: boolean) => void;
csvRows: any[]; setCsvRows: (rows: any[]) => void;
  csvFileName: string; setCsvFileName: (name: string) => void;
  uploading: boolean; setUploading: (u: boolean) => void;
  replaceDuplicates: boolean; setReplaceDuplicates: (r: boolean) => void;
  
  handleCreateTask: (e: React.FormEvent) => void;
  handleEditTaskSave: (e: React.FormEvent) => void;
  handleBulkUpload: () => void;
  handleCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
toggleFlag: (taskId: string, current: boolean) => void;
  openEditTask: (task: any) => void;
  
  members: any[];
  sprints: any[];
  phases: any[];
  taskTypes: any[];
  workflowStatuses: any[];
  profile: any;
  isAdmin: boolean;
  isClient: boolean;
  PRIORITY_COLORS: Record<string, string>;
  doneStatusIds: string[];
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

  const addViewBlocker = () => {
    if (!newViewBlockerDescription.trim()) return;
    setViewBlockers([...viewBlockers, { id: Date.now().toString(), description: newViewBlockerDescription, status: "open", raised_at: new Date().toISOString(), raiser: props.profile }]);
    setShowViewAddBlocker(false);
    setNewViewBlockerDescription("");
  };

  const resolveBlocker = (blockerId: string, _taskId?: string) => {
    setViewBlockers(viewBlockers.map((b: any) => b.id === blockerId ? { ...b, status: "resolved", resolver: props.profile } : b));
  };

  const checkAndTriggerBlockerAlert = async (_taskId: string, _title: string, _type: string) => false;
  const isDependencyWarnTarget = (_category: string) => false;
  const getUnfinishedDependencies = async (_taskId: string, _statuses: any[]) => [];
  const queryClient = { invalidateQueries: () => {} };
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
    profile, isAdmin, isClient, PRIORITY_COLORS, doneStatusIds
  } = props;
  const [taskDateOpen, setTaskDateOpen] = useState(false);
  const [editTaskDateOpen, setEditTaskDateOpen] = useState(false);

  return (
    <>
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
        <DialogContent>
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
                    <button
                      type="button"
                      onClick={() => { setConfirmDepDelId(d.id); setConfirmDepDelTaskId(viewTaskData?.id); }}
                      className="shrink-0 p-1 rounded hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600"
                      title="Remove dependency"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {viewAddDepOpen ? (
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
            )}
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
                    {b.status !== "resolved" && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => resolveBlocker(b.id, viewTaskData?.id)} className="shrink-0 h-7 px-2" title="Resolve">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {showViewAddBlocker ? (
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
            )}
          </div>

          {(viewTaskData?.assigned_to === profile?.id || isAdmin || viewTaskData?.created_by === profile?.id) && viewTaskData?.status_id && workflowStatuses && workflowTransitions && (
            <div className="mt-4">
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
                    p_changed_by_type: "admin",
                  });
                  if (error) {
                    toast.error(`Could not move task: ${error.message}`);
                    if (error.message.toLowerCase().includes("blocker")) {
                      await checkAndTriggerBlockerAlert(viewTaskData.id, viewTaskData.title, "status");
                    }
                    return;
                  }
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
