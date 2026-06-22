import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useWorkSettings, getPKTDateString } from "@/hooks/useWorkSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider, Tooltip as ShadcnTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, parseCSVLine, toSlug } from "@/lib/utils";
import { ArrowLeft, Plus, Trash2, Download, Search, ExternalLink, Upload, Pencil, Flag } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const STATUS_OPTIONS = ["active", "on_hold", "completed", "archived"];
const STATUS_COLORS: Record<string, string> = { active: "bg-green-100 text-green-800", on_hold: "bg-yellow-100 text-yellow-800", completed: "bg-blue-100 text-blue-800", archived: "bg-muted text-muted-foreground" };
const CHART_COLORS = ["hsl(82,100%,72%)", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [completionWarning, setCompletionWarning] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [logFilterDate, setLogFilterDate] = useState<string>(getPKTDateString());
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskEstimatedHours, setTaskEstimatedHours] = useState("");
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskEstimatedHours, setEditTaskEstimatedHours] = useState("");
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [csvRows, setCsvRows] = useState<{ rowNum: number; title: string; description: string; priority: string; estimated_hours: string; errors: string[] }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseDueDate, setPhaseDueDate] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [phaseTasksOpen, setPhaseTasksOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [completeTargetId, setCompleteTargetId] = useState<string | null>(null);
  const [completeTargetTitle, setCompleteTargetTitle] = useState("");

  const { data: resolvedId } = useQuery({
    queryKey: ["resolve-project-slug", slug],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name");
      const match = (data || []).find((p: any) => toSlug(p.name) === slug);
      return match?.id || null;
    },
    enabled: !!slug,
  });

  const id = resolvedId;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, clients(id, name)").eq("id", id!).single();
      if (error) throw error;
      setStatusNote(data.status_note || "");
      return data;
    },
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const [membersResult, logsResult] = await Promise.all([
        supabase.from("project_members").select("*, users(id, full_name, designation, avatar_url), project_roles(name)").eq("project_id", id!).is("removed_at", null),
        supabase.from("daily_logs").select("user_id, hours").eq("project_id", id!).eq("status", "submitted"),
      ]);
      const members = membersResult.data || [];
      const logs = logsResult.data || [];
      const hoursByUser: Record<string, number> = {};
      logs.forEach((l: any) => {
        hoursByUser[l.user_id] = (hoursByUser[l.user_id] || 0) + Number(l.hours || 0);
      });
      return members.map((m: any) => ({ ...m, _hoursSpent: hoursByUser[m.user_id] || 0 }));
    },
    enabled: !!id,
  });

  const { data: allEmployees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name, designation").eq("status", "active").neq("role", "admin").order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: employeeProjects } = useQuery({
    queryKey: ["employee-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("user_id, projects(name)").is("removed_at", null);
      const map: Record<string, string[]> = {};
      data?.forEach((m: any) => {
        if (!m.user_id) return;
        if (!map[m.user_id]) map[m.user_id] = [];
        if (m.projects?.name) map[m.user_id].push(m.projects.name);
      });
      return map;
    },
    enabled: isAdmin,
  });

  const { data: logs } = useQuery({
    queryKey: ["project-logs", id],
    queryFn: async () => {
      const { data } = await supabase.from("daily_logs").select("*, users(full_name)").eq("project_id", id!).eq("status", "submitted").order("log_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*, users:assigned_to(full_name)").eq("project_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["project-phases", id],
    queryFn: async () => {
      const { data } = await supabase.from("project_phases").select("*").eq("project_id", id!).order("sort_order", { ascending: true });
      return data || [];
    },
    enabled: !!id && isAdmin,
  });

  const phaseProgress = useMemo(() => {
    const progress: Record<string, number> = {};
    (phases || []).forEach((p: any) => {
      const phaseTasks = (tasks || []).filter((t: any) => t.phase_id === p.id);
      if (phaseTasks.length === 0) {
        progress[p.id] = 0;
      } else {
        const completed = phaseTasks.filter((t: any) => t.status === "complete").length;
        progress[p.id] = Math.round((completed / phaseTasks.length) * 100);
      }
    });
    return progress;
  }, [phases, tasks]);

  const phaseTaskCount = useMemo(() => {
    const counts: Record<string, number> = {};
    (tasks || []).forEach((t: any) => {
      if (t.phase_id) counts[t.phase_id] = (counts[t.phase_id] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const openPhaseTasks = (phase: any) => {
    setSelectedPhase(phase);
    setPhaseTasksOpen(true);
  };

  const availableEmployees = allEmployees?.filter((e) => {
    const notMember = !members?.some((m) => (m.users as any)?.id === e.id);
    const matchesSearch = e.full_name.toLowerCase().includes(memberSearch.toLowerCase());
    return notMember && matchesSearch;
  }) || [];

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  const addMembers = async () => {
    if (selectedUsers.length === 0) return;
    try {
      for (const uid of selectedUsers) {
        const emp = allEmployees?.find(e => e.id === uid);
        const roleName = roleInputs[uid]?.trim() || emp?.designation || "Member";
        let roleId: string | null = null;
        const { data: existingRole } = await supabase.from("project_roles").select("id").eq("project_id", id!).eq("name", roleName).maybeSingle();
        if (existingRole) { roleId = existingRole.id; } else {
          const { data: newRole } = await supabase.from("project_roles").insert({ project_id: id!, name: roleName }).select("id").single();
          roleId = newRole?.id || null;
        }
        await supabase.from("project_members").insert({ project_id: id!, user_id: uid, project_role_id: roleId });
        await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.member_added", target_entity: "project_members", target_id: id, metadata: { user_id: uid } });
      }
      toast.success(`${selectedUsers.length} member(s) added`);
      setSelectedUsers([]);
      setRoleInputs({});
      setAddMemberOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-members", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const removeMember = async (memberId: string, userId: string) => {
    await supabase.from("project_members").update({ removed_at: new Date().toISOString() }).eq("id", memberId);
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.member_removed", target_entity: "project_members", target_id: id, metadata: { user_id: userId } });
    toast.success("Member removed");
    queryClient.invalidateQueries({ queryKey: ["project-members", id] });
  };

  const changeStatus = async (newStatus: string) => {
    if (newStatus === "completed") { setPendingStatus(newStatus); setCompletionWarning(true); return; }
    await doStatusChange(newStatus);
  };

  const doStatusChange = async (newStatus: string) => {
    setCompletionWarning(false);
    await supabase.from("projects").update({ status: newStatus, status_note: statusNote || null }).eq("id", id!);
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.status_changed", target_entity: "projects", target_id: id, metadata: { new_status: newStatus } });
    toast.success(`Status changed to ${newStatus}`);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
  };

  const saveStatusNote = async () => {
    await supabase.from("projects").update({ status_note: statusNote || null }).eq("id", id!);
    toast.success("Note saved");
  };

  const formatHours = (h: number) => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; };

  const handleCreatePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseTitle.trim()) return;
    try {
      const { error } = await supabase.from("project_phases").insert({
        project_id: id!,
        title: phaseTitle.trim(),
        due_date: phaseDueDate || null,
      });
      if (error) throw error;
      toast.success("Phase created");
      setAddPhaseOpen(false);
      setPhaseTitle("");
      setPhaseDueDate("");
      queryClient.invalidateQueries({ queryKey: ["project-phases", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const exportCSV = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const { error } = await supabase.from("tasks").insert({
        project_id: id!,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        priority: taskPriority,
        estimated_hours: taskEstimatedHours ? parseFloat(taskEstimatedHours) : null,
        status: "unlinked",
        created_by: profile?.id,
      });
      if (error) throw error;
      toast.success("Task created");
      setAddTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("medium");
      setTaskEstimatedHours("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const openEditTask = (task: any) => {
    setEditTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || "");
    setEditTaskPriority(task.priority);
    setEditTaskEstimatedHours(task.estimated_hours ? String(task.estimated_hours) : "");
    setEditTaskOpen(true);
  };

  const handleEditTaskSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTaskTitle.trim() || !editTaskId) return;
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editTaskTitle.trim(),
          description: editTaskDescription.trim() || null,
          priority: editTaskPriority,
          estimated_hours: editTaskEstimatedHours ? parseFloat(editTaskEstimatedHours) : null,
        })
        .eq("id", editTaskId);
      if (error) throw error;
      toast.success("Task updated");
      setEditTaskOpen(false);
      setEditTaskId(null);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const VALID_PRIORITIES = ["high", "medium", "low"];

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
      const titleIdx = headers.indexOf("title");
      const descIdx = headers.indexOf("description");
      const prioIdx = headers.indexOf("priority");
      const estIdx = headers.indexOf("estimated_hours");
      if (titleIdx === -1) {
        toast.error("CSV must have a 'title' column");
        return;
      }
      const rows: { rowNum: number; title: string; description: string; priority: string; estimated_hours: string; errors: string[] }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = cols[titleIdx]?.trim() || "";
        const description = descIdx !== -1 ? (cols[descIdx]?.trim() || "") : "";
        let priority = prioIdx !== -1 ? (cols[prioIdx]?.trim().toLowerCase() || "") : "";
        const estimated_hours = estIdx !== -1 ? (cols[estIdx]?.trim() || "") : "";
        const errors: string[] = [];
        if (!title) errors.push("Title is required");
        if (priority && !VALID_PRIORITIES.includes(priority)) {
          errors.push(`Invalid priority "${priority}", defaulting to medium`);
          priority = "medium";
        }
        if (!priority) priority = "medium";
        if (estimated_hours && isNaN(Number(estimated_hours))) errors.push("Invalid estimated_hours");
        rows.push({ rowNum: i + 1, title, description, priority, estimated_hours, errors });
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkUpload = async () => {
    const validRows = csvRows.filter((r) => r.errors.length === 0 || r.errors.every((err) => err.startsWith("Invalid priority")));
    if (validRows.length === 0) {
      toast.error("No valid rows to upload");
      return;
    }
    setUploading(true);
    try {
      const inserts = validRows.map((r) => ({
        project_id: id!,
        title: r.title,
        description: r.description || null,
        priority: r.priority,
        estimated_hours: r.estimated_hours ? parseFloat(r.estimated_hours) : null,
        status: "unlinked",
        created_by: profile?.id,
      }));
      const { error } = await supabase.from("tasks").insert(inserts);
      if (error) throw error;
      toast.success(`${validRows.length} task(s) added`);
      setBulkTaskOpen(false);
      setCsvRows([]);
      setCsvFileName("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const requestComplete = (task: any) => {
    if (task.status === "complete") return;
    setCompleteTargetId(task.id);
    setCompleteTargetTitle(task.title);
    setCompleteConfirmOpen(true);
  };

  const confirmComplete = async () => {
    if (!completeTargetId) return;
    try {
      const { data: existing } = await supabase.from("tasks").select("goal_id").eq("id", completeTargetId).single();
      await supabase.from("tasks").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", completeTargetId);
      toast.success("Task completed");
      setCompleteConfirmOpen(false);
      setCompleteTargetId(null);
      setCompleteTargetTitle("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      if (existing?.goal_id) {
        const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("goal_id", existing.goal_id).neq("status", "complete");
        if (count === 0) {
          await supabase.from("goals").update({ status: "achieved", achieved_at: new Date().toISOString() }).eq("id", existing.goal_id);
          queryClient.invalidateQueries({ queryKey: ["goals"] });
        }
      }
    } catch (err: any) { toast.error(err.message); }
  };

  const PRIORITY_COLORS: Record<string, string> = { high: "bg-red-100 text-red-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-green-100 text-green-800" };
  const TASK_STATUS_COLORS: Record<string, string> = { unlinked: "bg-gray-100 text-gray-800", linked: "bg-blue-100 text-blue-800", in_progress: "bg-yellow-100 text-yellow-800", complete: "bg-green-100 text-green-800", returned: "bg-red-100 text-red-800" };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (!project) return <div className="text-center py-12 text-muted-foreground">Project not found</div>;

  // Stats data
  const totalHours = logs?.reduce((sum, l) => sum + Number(l.hours), 0) || 0;
  const hoursByMember = Object.values(
    (logs || []).reduce((acc: Record<string, { name: string; hours: number }>, l) => {
      const name = (l.users as any)?.full_name || "Unknown";
      acc[name] = acc[name] || { name, hours: 0 };
      acc[name].hours += Number(l.hours);
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.hours - a.hours);

  const categoryBreakdown = Object.values(
    (logs || []).reduce((acc: Record<string, { name: string; value: number }>, l) => {
      acc[l.category] = acc[l.category] || { name: l.category, value: 0 };
      acc[l.category].value += Number(l.hours);
      return acc;
    }, {})
  );

  const weeklyLogs = Object.entries(
    (logs || []).reduce((acc: Record<string, number>, l) => {
      const week = format(new Date(l.log_date), "yyyy-'W'II");
      acc[week] = (acc[week] || 0) + Number(l.hours);
      return acc;
    }, {})
  ).sort().map(([week, hours]) => ({ week, hours }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/projects"); }}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={STATUS_COLORS[project.status] || ""}>{project.status}</Badge>
            <span className="text-muted-foreground text-sm">{(project.clients as any)?.name}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members ({members?.length || 0})</TabsTrigger>
          {isAdmin && <TabsTrigger value="logs">Logs</TabsTrigger>}
          {isAdmin && <TabsTrigger value="stats">Stats</TabsTrigger>}
          <TabsTrigger value="tasks">Tasks ({tasks?.length || 0})</TabsTrigger>
          {isAdmin && <TabsTrigger value="phases">Phases</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-6 space-y-4">
            {project.description && <p className="text-muted-foreground">{project.description}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground block">Client</span><span className="font-medium">{(project.clients as any)?.name}</span></div>
              <div><span className="text-muted-foreground block">Start Date</span><span className="font-medium">{format(new Date(project.start_date), "MMM d, yyyy")}</span></div>
              <div><span className="text-muted-foreground block">End Date</span><span className="font-medium">{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground block">Status</span><span className="font-medium">{project.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
            </div>
            {(project as any).document_link && (
              <div className="pt-2">
                <span className="text-sm text-muted-foreground block mb-1">Document / Drive Link</span>
                <a
                  href={(project as any).document_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Document
                </a>
              </div>
            )}
            {isAdmin && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <span className="text-sm font-medium block mb-1">Change Status</span>
                    <Select value={project.status} onValueChange={changeStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium block mb-1">Status Note</span>
                  <div className="flex gap-2">
                    <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} className="flex-1" />
                    <Button variant="outline" size="sm" onClick={saveStatusNote}>Save</Button>
                  </div>
                </div>
              </div>
            )}
            {!isAdmin && project.status === "on_hold" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">This project is currently on hold.</div>
            )}
          </Card>
        </TabsContent>

        {/* MEMBERS — Admin: full management; Employee: view-only */}
        <TabsContent value="members">
          <Card>
            <div className="p-4 flex justify-between items-center border-b">
              <span className="font-medium">{members?.length || 0} members</span>
              {isAdmin && (
                <Button size="sm" onClick={() => setAddMemberOpen(true)} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Member</Button>
              )}
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Hours Spent</TableHead>
                {isAdmin && <><TableHead>Assigned</TableHead><TableHead className="text-right">Actions</TableHead></>}
              </TableRow></TableHeader>
              <TableBody>
                {members?.sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || "")).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={getAvatarUrl((m.users as any)?.avatar_url)} />
                          <AvatarFallback className="text-xs">{((m.users as any)?.full_name || "?")[0]}</AvatarFallback>
                        </Avatar>
                        {(m.users as any)?.full_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{(m.users as any)?.designation}</TableCell>
                    <TableCell className="text-muted-foreground">{m._hoursSpent}h</TableCell>
                    {isAdmin && (
                      <>
                        <TableCell className="text-muted-foreground">{format(new Date(m.assigned_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeMember(m.id, (m.users as any)?.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {(!members || members.length === 0) && <TableRow><TableCell colSpan={isAdmin ? 5 : 3} className="text-center text-muted-foreground py-8">No members assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* LOGS — admin only */}
        {isAdmin && (
          <TabsContent value="logs">
            <Card className="p-0 overflow-hidden">
              <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Filter by Date</span>
                    <Input
                      type="date"
                      value={logFilterDate}
                      onChange={(e) => setLogFilterDate(e.target.value)}
                      className="h-9 w-[180px] bg-background"
                    />
                  </div>
                  <div className="pt-5">
                    <span className="text-sm font-medium">
                      {(logs || []).filter(l => !logFilterDate || l.log_date === logFilterDate).length} logs found
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV(
                  (logs || []).filter(l => !logFilterDate || l.log_date === logFilterDate).map((l) => ({ Date: l.log_date, Employee: (l.users as any)?.full_name, Category: l.category, Hours: l.hours, Description: l.description })),
                  `${project.name}-logs-${logFilterDate || "all"}.csv`
                )}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
              </div>

              <div className="divide-y">
                {(() => {
                  const filtered = (logs || []).filter(l => !logFilterDate || l.log_date === logFilterDate);

                  // Group by member
                  const memberMap: Record<string, { full_name: string; logs: any[] }> = {};
                  members?.forEach(m => {
                    const u = m.users as any;
                    if (u) memberMap[u.id] = { full_name: u.full_name, logs: [] };
                  });

                  filtered.forEach(l => {
                    if (memberMap[l.user_id]) {
                      memberMap[l.user_id].logs.push(l);
                    } else {
                      memberMap[l.user_id] = { full_name: (l.users as any)?.full_name || "Unknown", logs: [l] };
                    }
                  });

                  const sortedMembers = Object.values(memberMap).sort((a, b) => a.full_name.localeCompare(b.full_name));

                  if (sortedMembers.length === 0) {
                    return <div className="py-12 text-center text-muted-foreground">No members assigned to this project</div>;
                  }

                  return sortedMembers.map((m, idx) => (
                    <div key={idx} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <h3 className="font-bold text-sm uppercase tracking-wide">{m.full_name}</h3>
                        </div>
                        {m.logs.length > 0 && (
                          <Badge variant="secondary" className="bg-primary text-black border-primary/20">
                            {formatHours(m.logs.reduce((sum, l) => sum + Number(l.hours), 0))}
                          </Badge>
                        )}
                      </div>

                      {m.logs.length > 0 ? (
                        <div className="grid gap-2 pl-3">
                          {m.logs.map(log => (
                            <div key={log.id} className="bg-muted/50 rounded-lg p-3 border border-border/50">
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline" className="text-[10px] uppercase">{log.category}</Badge>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary text-black">{formatHours(Number(log.hours))}</span>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{log.description}</p>
              </div>
            ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pl-3 italic">No logs submitted for this date</p>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </Card>
          </TabsContent>
        )}

        {/* TASKS — all users */}
        {!isAdmin && (
          <TabsContent value="tasks" className="space-y-4">
            <h2 className="text-lg font-semibold">My Tasks</h2>
            {(() => {
              const myTasks = (tasks || []).filter((t: any) => t.assigned_to === profile?.id);
              if (myTasks.length === 0) return <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>;
              return (
                <div className="space-y-2">
                  <TooltipProvider>
                    {myTasks.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-3 min-w-0">
                          <ShadcnTooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <span>
                                <Checkbox
                                  id={`task-${t.id}`}
                                  checked={t.status === "complete"}
                                  disabled={t.status === "complete"}
                                  onCheckedChange={() => requestComplete(t)}
                                  className="h-5 w-5 border-black"
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Mark as Complete</p>
                            </TooltipContent>
                          </ShadcnTooltip>
                          <div className="min-w-0">
                            <span className={`text-sm font-medium ${t.status === "complete" ? "line-through text-muted-foreground" : ""}`}>
                              {t.title}
                              {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5" />}
                            </span>
                            {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                          {t.estimated_hours && <Badge variant="secondary" className="text-xs">{t.estimated_hours}h</Badge>}
                          <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </TooltipProvider>
                </div>
              );
            })()}
          </TabsContent>
        )}

        {/* TASKS — admin only */}
        {isAdmin && (
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <div className="flex gap-2">
                <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="linked">Linked</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setBulkTaskOpen(true)} className="rounded-button"><Upload className="h-4 w-4 mr-1" />Bulk Add Tasks</Button>
                <Button size="sm" onClick={() => setAddTaskOpen(true)} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Task</Button>
              </div>
            </div>

            {(() => {
              const filteredTasks = (tasks || []).filter(
                (t: any) => taskStatusFilter === "all" || t.status === taskStatusFilter
              );
              return filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {t.title}
                        {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5 shrink-0" />}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                      {(t as any).users?.full_name && <Badge variant="secondary" className="text-xs">{(t as any).users?.full_name}</Badge>}
                      {t.estimated_hours && <Badge variant="secondary" className="text-xs">{t.estimated_hours}h</Badge>}
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditTask(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          </TabsContent>
        )}

        {/* PHASES — admin only */}
        {isAdmin && (
          <TabsContent value="phases">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Phases</h3>
              <Button size="sm" className="rounded-button bg-primary text-black hover:bg-black hover:text-white active:bg-black" onClick={() => setAddPhaseOpen(true)}>Add Phase</Button>
            </div>
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phases yet.</p>
            ) : (
              <div className="space-y-2">
                {phases.map((p: any) => (
                  <div key={p.id} className="flex flex-col gap-2 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openPhaseTasks(p)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{p.title}</span>
                        <span className="text-xs text-muted-foreground">({phaseTaskCount[p.id] || 0} tasks)</span>
                        {p.due_date && <span className="text-xs text-muted-foreground">Due {format(new Date(p.due_date), "MMM d, yyyy")}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{phaseProgress[p.id]}%</span>
                        <Button variant="outline" size="sm" className="rounded-button h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${slug}/phases/${p.id}`); }}>Edit</Button>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 border border-black">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${phaseProgress[p.id]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Create Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Tasks Dialog */}
      <Dialog open={bulkTaskOpen} onOpenChange={(open) => { if (!uploading) setBulkTaskOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bulk Add Tasks</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">CSV Format</p>
              <p className="text-xs text-muted-foreground">Your CSV must have these column headers on the first row:</p>
              <div className="bg-muted rounded p-2 text-xs font-mono">title,description,priority,estimated_hours</div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                <li><strong>title</strong> — required</li>
                <li><strong>description</strong> — optional</li>
                <li><strong>priority</strong> — must be one of: high, medium, low (case-insensitive, defaults to medium)</li>
                <li><strong>estimated_hours</strong> — optional decimal number (e.g. 1, 1.5, 2.25)</li>
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
                <p className="text-sm font-medium">Preview ({csvRows.length} row{csvRows.length !== 1 ? "s" : ""})</p>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium">#</th>
                        <th className="text-left p-2 font-medium">Title</th>
                        <th className="text-left p-2 font-medium">Description</th>
                        <th className="text-left p-2 font-medium">Priority</th>
                        <th className="text-left p-2 font-medium">Est. Hours</th>
                        <th className="text-left p-2 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r) => (
                        <tr key={r.rowNum} className={r.errors.length > 0 ? "bg-red-50" : "border-t"}>
                          <td className="p-2 text-muted-foreground">{r.rowNum}</td>
                          <td className={`p-2 font-medium ${!r.title ? "text-red-500" : ""}`}>{r.title || <span className="italic text-red-400">empty</span>}</td>
                          <td className="p-2 text-muted-foreground">{r.description || "—"}</td>
                          <td className="p-2">
                            <Badge className={PRIORITY_COLORS[r.priority] || ""}>{r.priority}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">{r.estimated_hours || "—"}</td>
                          <td className="p-2">
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
            <Button type="button" variant="outline" onClick={() => { setBulkTaskOpen(false); setCsvRows([]); setCsvFileName(""); }} disabled={uploading}>Cancel</Button>
            <Button type="button" onClick={handleBulkUpload} disabled={csvRows.length === 0 || uploading}>
              {uploading ? "Uploading..." : `Confirm Upload${csvRows.length > 0 ? ` (${csvRows.filter((r) => r.errors.length === 0 || r.errors.every((err) => err.startsWith("Invalid priority"))).length} valid)` : ""}`}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Sheet */}
      <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <SheetContent className="flex flex-col h-full">
          <SheetHeader><SheetTitle>Add Members</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {availableEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {memberSearch ? "No matching employees found." : "All employees are already on this project."}
              </p>
            )}
            {availableEmployees.map((e) => (
              <div key={e.id} className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedUsers.includes(e.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => toggleUser(e.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{e.full_name}</span>
                    <span className="text-xs text-muted-foreground block">{e.designation}</span>
                    {employeeProjects?.[e.id] && employeeProjects[e.id].length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-black">
                        <span className="text-[10px] uppercase tracking-wider font-semibold">Active Projects:</span>
                        {employeeProjects[e.id].map((pName, idx) => (
                          <span key={idx} className="text-[10px] bg-primary px-1.5 py-0.5 rounded-sm">
                            {pName}
                          </span>
                        ))}
              </div>
            )}
                  </div>
                  {selectedUsers.includes(e.id) && <Badge className="bg-primary text-primary-foreground">Selected</Badge>}
                </div>
                {selectedUsers.includes(e.id) && (
                  <Input className="mt-2" placeholder="Project role (e.g. Lead Developer)" value={roleInputs[e.id] || ""} onChange={(e2) => setRoleInputs({ ...roleInputs, [e.id]: e2.target.value })} onClick={(e2) => e2.stopPropagation()} />
                )}
              </div>
            ))}
          </div>
          <SheetFooter className="mt-4 pt-4 border-t shrink-0">
            <Button onClick={addMembers} disabled={selectedUsers.length === 0} className="rounded-button w-full">Add {selectedUsers.length} Member{selectedUsers.length !== 1 ? "s" : ""}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add Phase Dialog */}
      <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Phase</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePhase} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase Title *</label>
              <Input value={phaseTitle} onChange={(e) => setPhaseTitle(e.target.value)} placeholder="e.g. Alpha" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" value={phaseDueDate} onChange={(e) => setPhaseDueDate(e.target.value)} />
            </div>
            <Button type="submit" className="rounded-button w-full">Create Phase</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Phase Tasks Dialog */}
      <Dialog open={phaseTasksOpen} onOpenChange={setPhaseTasksOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedPhase?.title} — Tasks</DialogTitle></DialogHeader>
          {(() => {
            const phaseTasks = (tasks || []).filter((t: any) => t.phase_id === selectedPhase?.id);
            if (phaseTasks.length === 0) return <p className="text-sm text-muted-foreground py-4">No tasks assigned to this phase.</p>;
            return (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {phaseTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                      {(t as any).users?.full_name && <Badge variant="secondary" className="text-xs">{(t as any).users?.full_name}</Badge>}
                      {t.estimated_hours && <Badge variant="secondary" className="text-xs">{t.estimated_hours}h</Badge>}
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Task Complete Confirmation */}
      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete task?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to mark "{completeTargetTitle}" as complete? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCompleteConfirmOpen(false); setCompleteTargetId(null); setCompleteTargetTitle(""); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplete}>Complete Task</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Completion Warning */}
      <AlertDialog open={completionWarning} onOpenChange={setCompletionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this project?</AlertDialogTitle>
            <AlertDialogDescription>Setting to Completed will lock all log submissions for this project. This action can be reversed by changing the status back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => doStatusChange(pendingStatus)}>Complete Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
