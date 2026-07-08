import { useState, useMemo, useEffect } from "react";
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
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider, Tooltip as ShadcnTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader as ShadcnTableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, parseCSVLine, toSlug } from "@/lib/utils";
import { ArrowLeft, Plus, Trash2, Download, Search, ExternalLink, Upload, Pencil, Flag, Eye, EyeOff, MessageSquare, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

import { PROJECT_STATUS_OPTIONS as STATUS_OPTIONS, PROJECT_STATUS_COLORS as STATUS_COLORS, getAllowedTransitions } from "@/lib/workflow";
const CHART_COLORS = ["hsl(82,100%,72%)", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState<"resource" | "client">("resource");
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
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskStoryPoints, setTaskStoryPoints] = useState("");
  const [taskClientVisible, setTaskClientVisible] = useState(true);
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskEstimatedHours, setEditTaskEstimatedHours] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskStoryPoints, setEditTaskStoryPoints] = useState("");
  const [editTaskClientVisible, setEditTaskClientVisible] = useState(true);
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [editTaskStatusId, setEditTaskStatusId] = useState<string>("");
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
  const [dependencyWarning, setDependencyWarning] = useState("");
  const [addDepOpen, setAddDepOpen] = useState(false);
  const [addDepTaskId, setAddDepTaskId] = useState("");
  const [addDepType, setAddDepType] = useState("finish_to_start");
  const [addDepForTaskId, setAddDepForTaskId] = useState<string | null>(null);
  const [viewAddDepOpen, setViewAddDepOpen] = useState(false);
  const [viewAddDepTaskId, setViewAddDepTaskId] = useState("");
  const [viewAddDepType, setViewAddDepType] = useState("finish_to_start");
  const [newStatusUpdate, setNewStatusUpdate] = useState("");
  const [newStatusUpdateVisible, setNewStatusUpdateVisible] = useState(false);
  const [burndownScope, setBurndownScope] = useState<string>("project");

  const [addSprintOpen, setAddSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");
  const [editSprintOpen, setEditSprintOpen] = useState(false);
  const [editSprintId, setEditSprintId] = useState<string | null>(null);
  const [editSprintName, setEditSprintName] = useState("");
  const [editSprintStartDate, setEditSprintStartDate] = useState("");
  const [editSprintEndDate, setEditSprintEndDate] = useState("");
  const [editSprintStatus, setEditSprintStatus] = useState("");
  const [sprintTasksOpen, setSprintTasksOpen] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [taskSprintId, setTaskSprintId] = useState("");
  const [editTaskSprintId, setEditTaskSprintId] = useState("");

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

  // Derived splits: resources = non-Client, clientMembers = Client designation
  const resourceMembers = (members || []).filter((m: any) => (m.users as any)?.designation !== "Client");
  const clientMembers = (members || []).filter((m: any) => (m.users as any)?.designation === "Client");

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

  const { data: workflowStatuses } = useQuery({
    queryKey: ["project-workflow", id],
    queryFn: async () => {
      if (!project?.workflow_template_id) return [];
      const { data } = await supabase
        .from("workflow_statuses")
        .select("*")
        .eq("workflow_template_id", project.workflow_template_id)
        .order("sort_order", { ascending: true });
      return data || [];
    },
    enabled: !!id && !!project?.workflow_template_id,
  });

  const { data: workflowTransitions } = useQuery({
    queryKey: ["project-workflow-transitions", id],
    queryFn: async () => {
      if (!project?.workflow_template_id) return [];
      const { data } = await supabase
        .from("workflow_transitions")
        .select("*")
        .eq("workflow_template_id", project.workflow_template_id);
      return data || [];
    },
    enabled: !!id && !!project?.workflow_template_id,
  });

  const { data: workflowTemplate } = useQuery({
    queryKey: ["project-workflow-template", id],
    queryFn: async () => {
      if (!project?.workflow_template_id) return null;
      const { data } = await supabase
        .from("workflow_templates")
        .select("id, name")
        .eq("id", project.workflow_template_id)
        .single();
      return data;
    },
    enabled: !!id && !!project?.workflow_template_id,
  });

  const [viewTaskData, setViewTaskData] = useState<any>(null);

  const activeEditId = editTaskId;
  const activeViewId = viewTaskData?.id;

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["task-comments", activeEditId],
    queryFn: async () => {
      if (!activeEditId) return [];
      const { data } = await supabase
        .from("task_comments")
        .select("*, author:users!task_comments_author_id_fkey(full_name)")
        .eq("task_id", activeEditId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!activeEditId,
  });

  const { data: blockers = [], isLoading: blockersLoading } = useQuery({
    queryKey: ["task-blockers", activeEditId],
    queryFn: async () => {
      if (!activeEditId) return [];
      const { data } = await supabase
        .from("task_blockers")
        .select("*, raiser:users!task_blockers_raised_by_fkey(full_name), resolver:users!task_blockers_resolved_by_fkey(full_name)")
        .eq("task_id", activeEditId)
        .order("raised_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeEditId,
  });

  const { data: viewComments = [], isLoading: viewCommentsLoading } = useQuery({
    queryKey: ["task-comments-view", activeViewId],
    queryFn: async () => {
      if (!activeViewId) return [];
      const { data } = await supabase
        .from("task_comments")
        .select("*, author:users!task_comments_author_id_fkey(full_name)")
        .eq("task_id", activeViewId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!activeViewId,
  });

  const { data: viewBlockers = [], isLoading: viewBlockersLoading } = useQuery({
    queryKey: ["task-blockers-view", activeViewId],
    queryFn: async () => {
      if (!activeViewId) return [];
      const { data } = await supabase
        .from("task_blockers")
        .select("*, raiser:users!task_blockers_raised_by_fkey(full_name), resolver:users!task_blockers_resolved_by_fkey(full_name)")
        .eq("task_id", activeViewId)
        .order("raised_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeViewId,
  });

  const { data: editDeps = [], isLoading: editDepsLoading } = useQuery({
    queryKey: ["task-deps-edit", activeEditId],
    queryFn: async () => {
      if (!activeEditId) return [];
      const { data } = await supabase
        .from("task_dependencies")
        .select("*, depends_on:tasks!task_dependencies_depends_on_task_id_fkey(id, title)")
        .eq("task_id", activeEditId);
      return data || [];
    },
    enabled: !!activeEditId,
  });

  const { data: viewDeps = [], isLoading: viewDepsLoading } = useQuery({
    queryKey: ["task-deps-view", activeViewId],
    queryFn: async () => {
      if (!activeViewId) return [];
      const { data } = await supabase
        .from("task_dependencies")
        .select("*, depends_on:tasks!task_dependencies_depends_on_task_id_fkey(id, title)")
        .eq("task_id", activeViewId);
      return data || [];
    },
    enabled: !!activeViewId,
  });

  const { data: scheduleSnapshots = [] } = useQuery({
    queryKey: ["task-schedule-snapshots", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("task_schedule_snapshots")
        .select("task_id, is_critical")
        .in("task_id", (tasks || []).map((t: any) => t.id))
        .order("snapshot_date", { ascending: false });
      return data || [];
    },
    enabled: !!id && (tasks || []).length > 0,
  });

  const criticalTaskIds = useMemo(() => {
    return new Set(scheduleSnapshots.filter((s: any) => s.is_critical).map((s: any) => s.task_id));
  }, [scheduleSnapshots]);

  const { data: latestHealth } = useQuery({
    queryKey: ["project-health-latest", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("project_health_snapshots")
        .select("*")
        .eq("project_id", id)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();
      return data || null;
    },
    enabled: !!id,
  });

  const { data: healthTrend = [] } = useQuery({
    queryKey: ["project-health-trend", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("project_health_snapshots")
        .select("*")
        .eq("project_id", id)
        .order("snapshot_date", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: statusUpdates = [], isLoading: statusUpdatesLoading } = useQuery({
    queryKey: ["project-status-updates", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("project_status_updates")
        .select("*, author:users!project_status_updates_author_id_fkey(full_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: projectBlockers = [] } = useQuery({
    queryKey: ["project-blockers-all", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("task_blockers")
        .select("*, raiser:users!task_blockers_raised_by_fkey(full_name)")
        .eq("project_id", id)
        .order("raised_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["project-sprints", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("sprints")
        .select("*")
        .eq("project_id", id)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: sprintSnapshots = [] } = useQuery({
    queryKey: ["project-sprint-snapshots", id],
    queryFn: async () => {
      if (!id || sprints.length === 0) return [];
      const { data } = await supabase
        .from("sprint_snapshots")
        .select("*, sprints(name, end_date)")
        .in("sprint_id", sprints.map((s: any) => s.id))
        .order("snapshot_date", { ascending: true });
      return data || [];
    },
    enabled: !!id && sprints.length > 0,
  });

  const velocityData = useMemo(() => {
    const completedSprints = sprints.filter((s: any) => s.status === "completed");
    return completedSprints.map((s: any) => {
      const snapshots = sprintSnapshots.filter((ss: any) => ss.sprint_id === s.id);
      const lastSnapshot = snapshots[snapshots.length - 1];
      return {
        name: s.name,
        velocity: Number(lastSnapshot?.completed_points || 0),
        committed: Number(lastSnapshot?.committed_points || 0),
        added: Number(lastSnapshot?.points_added_mid_sprint || 0),
        removed: Number(lastSnapshot?.points_removed_mid_sprint || 0),
      };
    });
  }, [sprints, sprintSnapshots]);

  const avgVelocity = useMemo(() => {
    if (velocityData.length === 0) return 0;
    return velocityData.reduce((sum: number, v: any) => sum + v.velocity, 0) / velocityData.length;
  }, [velocityData]);

  const sprintTaskCount = useMemo(() => {
    const counts: Record<string, number> = {};
    (tasks || []).forEach((t: any) => {
      if (t.sprint_id) counts[t.sprint_id] = (counts[t.sprint_id] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const sprintSpTotal = useMemo(() => {
    const sp: Record<string, number> = {};
    (tasks || []).forEach((t: any) => {
      if (t.sprint_id) sp[t.sprint_id] = (sp[t.sprint_id] || 0) + Number(t.story_points || 0);
    });
    return sp;
  }, [tasks]);

  const [newComment, setNewComment] = useState("");
  const [newViewComment, setNewViewComment] = useState("");
  const [newBlockerDescription, setNewBlockerDescription] = useState("");
  const [newViewBlockerDescription, setNewViewBlockerDescription] = useState("");
  const [showAddBlocker, setShowAddBlocker] = useState(false);
  const [showViewAddBlocker, setShowViewAddBlocker] = useState(false);

  const addComment = async (taskId: string) => {
    if (!newComment.trim() || !profile) return;
    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId,
      author_id: profile.id,
      author_type: "human",
      body: newComment.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  const addViewComment = async () => {
    if (!newViewComment.trim() || !viewTaskData?.id || !profile) return;
    const { error } = await supabase.from("task_comments").insert({
      task_id: viewTaskData.id,
      author_id: profile.id,
      author_type: "human",
      body: newViewComment.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewViewComment("");
    queryClient.invalidateQueries({ queryKey: ["task-comments-view", viewTaskData.id] });
  };

  const addBlocker = async (taskId: string, projectId: string) => {
    if (!newBlockerDescription.trim() || !profile) return;
    const { error } = await supabase.from("task_blockers").insert({
      project_id: projectId,
      task_id: taskId,
      description: newBlockerDescription.trim(),
      raised_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }
    setNewBlockerDescription("");
    setShowAddBlocker(false);
    queryClient.invalidateQueries({ queryKey: ["task-blockers", taskId] });
  };

  const addViewBlocker = async () => {
    if (!newViewBlockerDescription.trim() || !viewTaskData?.id || !profile) return;
    const { error } = await supabase.from("task_blockers").insert({
      project_id: viewTaskData.project_id,
      task_id: viewTaskData.id,
      description: newViewBlockerDescription.trim(),
      raised_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }
    setNewViewBlockerDescription("");
    setShowViewAddBlocker(false);
    queryClient.invalidateQueries({ queryKey: ["task-blockers-view", viewTaskData.id] });
  };

  const resolveBlocker = async (blockerId: string, taskId: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from("task_blockers")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: profile.id })
      .eq("id", blockerId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["task-blockers", taskId] });
    queryClient.invalidateQueries({ queryKey: ["task-blockers-view", taskId] });
  };

  // Dependency warning effect — fires when edit status changes to done/in_progress
  useEffect(() => {
    setDependencyWarning("");
    if (!editTaskId || !editTaskStatusId || !workflowStatuses) return;
    const selectedStatus = workflowStatuses.find((s: any) => s.id === editTaskStatusId);
    if (!selectedStatus || (selectedStatus.category !== "done" && selectedStatus.category !== "in_progress")) return;

    supabase
      .from("task_dependencies")
      .select("*, depends_on:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status_id)")
      .eq("task_id", editTaskId)
      .eq("dependency_type", "finish_to_start")
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const unfinished = data.filter((d: any) => {
          const depStatus = workflowStatuses.find((s: any) => s.id === d.depends_on?.status_id);
          return depStatus?.category !== "done";
        });
        if (unfinished.length > 0) {
          setDependencyWarning(
            `Unfinished dependencies: ${unfinished.map((d: any) => d.depends_on?.title).join(", ")}`
          );
        }
      });
  }, [editTaskStatusId, editTaskId, workflowStatuses]);

  const addDependency = async (taskId: string) => {
    if (!addDepTaskId || !profile) return;
    const { error } = await supabase.from("task_dependencies").insert({
      task_id: taskId,
      depends_on_task_id: addDepTaskId,
      dependency_type: addDepType,
      created_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }
    setAddDepOpen(false);
    setAddDepTaskId("");
    setAddDepType("finish_to_start");
    setAddDepForTaskId(null);
    queryClient.invalidateQueries({ queryKey: ["task-deps-edit", taskId] });
    queryClient.invalidateQueries({ queryKey: ["task-deps-view", taskId] });
  };

  const removeDependency = async (depId: string, taskId: string) => {
    const { error } = await supabase.from("task_dependencies").delete().eq("id", depId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["task-deps-edit", taskId] });
    queryClient.invalidateQueries({ queryKey: ["task-deps-view", taskId] });
  };

  const addViewDependency = async () => {
    if (!viewAddDepTaskId || !viewTaskData?.id || !profile) return;
    const { error } = await supabase.from("task_dependencies").insert({
      task_id: viewTaskData.id,
      depends_on_task_id: viewAddDepTaskId,
      dependency_type: viewAddDepType,
      created_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }
    setViewAddDepOpen(false);
    setViewAddDepTaskId("");
    setViewAddDepType("finish_to_start");
    queryClient.invalidateQueries({ queryKey: ["task-deps-view", viewTaskData.id] });
    queryClient.invalidateQueries({ queryKey: ["task-deps-edit", viewTaskData.id] });
  };

  const addStatusUpdate = async () => {
    if (!newStatusUpdate.trim() || !profile || !id) return;
    const { error } = await supabase.from("project_status_updates").insert({
      project_id: id,
      author_id: profile.id,
      author_type: "human",
      summary: newStatusUpdate.trim(),
      visible_to_client: newStatusUpdateVisible,
    });
    if (error) { toast.error(error.message); return; }
    setNewStatusUpdate("");
    setNewStatusUpdateVisible(false);
    toast.success("Status update posted");
    queryClient.invalidateQueries({ queryKey: ["project-status-updates", id] });
  };

  const createSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStartDate || !sprintEndDate || !id) return;
    const { error } = await supabase.from("sprints").insert({
      project_id: id,
      name: sprintName.trim(),
      start_date: sprintStartDate,
      end_date: sprintEndDate,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Sprint created");
    setAddSprintOpen(false);
    setSprintName("");
    setSprintStartDate("");
    setSprintEndDate("");
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
  };

  const openEditSprint = (sprint: any) => {
    setEditSprintId(sprint.id);
    setEditSprintName(sprint.name);
    setEditSprintStartDate(sprint.start_date);
    setEditSprintEndDate(sprint.end_date);
    setEditSprintStatus(sprint.status);
    setEditSprintOpen(true);
  };

  const handleEditSprintSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSprintName.trim() || !editSprintStartDate || !editSprintEndDate || !editSprintId) return;
    const updates: any = {
      name: editSprintName.trim(),
      start_date: editSprintStartDate,
      end_date: editSprintEndDate,
    };
    if (editSprintStatus) {
      const oldStatus = sprints.find((s: any) => s.id === editSprintId)?.status;
      updates.status = editSprintStatus;
      const { error } = await supabase.from("sprints").update(updates).eq("id", editSprintId);
      if (error) { toast.error(error.message); return; }
      if (editSprintStatus === "active" && oldStatus !== "active") {
        await supabase.rpc("compute_sprint_snapshot", { p_sprint_id: editSprintId });
      }
      if (editSprintStatus === "completed" && oldStatus !== "completed") {
        await supabase.rpc("compute_sprint_snapshot", { p_sprint_id: editSprintId });
      }
    } else {
      const { error } = await supabase.from("sprints").update(updates).eq("id", editSprintId);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Sprint updated");
    setEditSprintOpen(false);
    setEditSprintId(null);
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
    queryClient.invalidateQueries({ queryKey: ["project-sprint-snapshots", id] });
  };

  const deleteSprint = async (sprintId: string) => {
    if (!confirm("Delete this sprint? Tasks will be unassigned from it.")) return;
    const { error } = await supabase.from("sprints").delete().eq("id", sprintId);
    if (error) { toast.error(error.message); return; }
    toast.success("Sprint deleted");
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
  };

  const openSprintTasks = (sprint: any) => {
    setSelectedSprint(sprint);
    setSprintTasksOpen(true);
  };

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
    const matchesMode =
      addMemberMode === "client"
        ? e.designation === "Client"
        : e.designation !== "Client";
    return notMember && matchesSearch && matchesMode;
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
      const initialStatus = workflowStatuses?.find((s: any) => s.is_initial);
      const { error } = await supabase.from("tasks").insert({
        project_id: id!,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        priority: taskPriority,
        estimated_hours: taskEstimatedHours ? parseFloat(taskEstimatedHours) : null,
        due_date: taskDueDate || null,
        story_points: taskStoryPoints ? parseInt(taskStoryPoints, 10) : null,
        client_visible: taskClientVisible,
        assigned_to: taskAssignedTo || null,
        sprint_id: taskSprintId || null,
        status_id: initialStatus?.id || null,
        status: initialStatus?.name || "unlinked",
        created_by: profile?.id,
      });
      if (error) throw error;
      toast.success("Task created");
      setAddTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("medium");
      setTaskEstimatedHours("");
      setTaskDueDate("");
      setTaskStoryPoints("");
      setTaskClientVisible(true);
      setTaskAssignedTo("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const openEditTask = (task: any) => {
    setEditTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || "");
    setEditTaskPriority(task.priority);
    setEditTaskEstimatedHours(task.estimated_hours ? String(task.estimated_hours) : "");
    setEditTaskDueDate(task.due_date || "");
    setEditTaskStoryPoints(task.story_points ? String(task.story_points) : "");
    setEditTaskClientVisible(task.client_visible !== false);
    setEditTaskAssignedTo(task.assigned_to || "");
    setEditTaskStatusId(task.status_id || "");
    setEditTaskSprintId(task.sprint_id || "");
    setEditTaskOpen(true);
  };

  const handleEditTaskSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTaskTitle.trim() || !editTaskId) return;
    try {
      const updates: any = {
        title: editTaskTitle.trim(),
        description: editTaskDescription.trim() || null,
        priority: editTaskPriority,
        estimated_hours: editTaskEstimatedHours ? parseFloat(editTaskEstimatedHours) : null,
        due_date: editTaskDueDate || null,
        story_points: editTaskStoryPoints ? parseInt(editTaskStoryPoints, 10) : null,
        client_visible: editTaskClientVisible,
        assigned_to: editTaskAssignedTo || null,
        sprint_id: editTaskSprintId || null,
      };
      if (editTaskStatusId) {
        updates.status_id = editTaskStatusId;
      }
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editTaskId);
      if (error) throw error;
      toast.success("Task updated");
      setEditTaskOpen(false);
      setEditTaskId(null);
      setEditTaskDueDate("");
      setEditTaskStoryPoints("");
      setEditTaskClientVisible(true);
      setEditTaskAssignedTo("");
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
      const dueDateIdx = headers.indexOf("due_date");
      const storyPtsIdx = headers.indexOf("story_points");
      const clientVisIdx = headers.indexOf("client_visible");
      if (titleIdx === -1) {
        toast.error("CSV must have a 'title' column");
        return;
      }
      const rows: { rowNum: number; title: string; description: string; priority: string; estimated_hours: string; due_date: string; story_points: string; client_visible: string; errors: string[] }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = cols[titleIdx]?.trim() || "";
        const description = descIdx !== -1 ? (cols[descIdx]?.trim() || "") : "";
        let priority = prioIdx !== -1 ? (cols[prioIdx]?.trim().toLowerCase() || "") : "";
        const estimated_hours = estIdx !== -1 ? (cols[estIdx]?.trim() || "") : "";
        const due_date = dueDateIdx !== -1 ? (cols[dueDateIdx]?.trim() || "") : "";
        const story_points = storyPtsIdx !== -1 ? (cols[storyPtsIdx]?.trim() || "") : "";
        const client_visible = clientVisIdx !== -1 ? (cols[clientVisIdx]?.trim().toLowerCase() || "") : "";
        const errors: string[] = [];
        if (!title) errors.push("Title is required");
        if (priority && !VALID_PRIORITIES.includes(priority)) {
          errors.push(`Invalid priority "${priority}", defaulting to medium`);
          priority = "medium";
        }
        if (!priority) priority = "medium";
        if (estimated_hours && isNaN(Number(estimated_hours))) errors.push("Invalid estimated_hours");
        if (due_date && isNaN(Date.parse(due_date))) errors.push("Invalid due_date");
        if (story_points && isNaN(Number(story_points))) errors.push("Invalid story_points");
        if (client_visible && !["true", "false", "yes", "no", "1", "0"].includes(client_visible)) errors.push("Invalid client_visible");
        rows.push({ rowNum: i + 1, title, description, priority, estimated_hours, due_date, story_points, client_visible, errors });
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
      const initialStatus = workflowStatuses?.find((s: any) => s.is_initial);
      const inserts = validRows.map((r) => ({
        project_id: id!,
        title: r.title,
        description: r.description || null,
        priority: r.priority,
        estimated_hours: r.estimated_hours ? parseFloat(r.estimated_hours) : null,
        due_date: r.due_date || null,
        story_points: r.story_points ? parseInt(r.story_points, 10) : null,
        client_visible: !["false", "no", "0"].includes(r.client_visible),
        status_id: initialStatus?.id || null,
        status: initialStatus?.name || "unlinked",
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
      const completeStatus = workflowStatuses?.find((s: any) => s.name === "complete");
      const updateData: any = { completed_at: new Date().toISOString() };
      if (completeStatus) {
        updateData.status_id = completeStatus.id;
      } else {
        updateData.status = "complete";
      }
      await supabase.from("tasks").update(updateData).eq("id", completeTargetId);
      toast.success("Task completed");
      setCompleteConfirmOpen(false);
      setCompleteTargetId(null);
      setCompleteTargetTitle("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
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
          <TabsTrigger value="resources">Resources ({resourceMembers.length})</TabsTrigger>
          <TabsTrigger value="clients">Client's Member ({clientMembers.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="logs">Logs</TabsTrigger>}
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks?.length || 0})</TabsTrigger>
          {isAdmin && <TabsTrigger value="phases">Phases</TabsTrigger>}
          <TabsTrigger value="sprints">Sprints ({sprints?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-6 space-y-4">
            {project.description && <p className="text-muted-foreground">{project.description}</p>}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div><span className="text-muted-foreground block">Client</span><span className="font-medium">{(project.clients as any)?.name}</span></div>
              <div><span className="text-muted-foreground block">Start Date</span><span className="font-medium">{format(new Date(project.start_date), "MMM d, yyyy")}</span></div>
              <div><span className="text-muted-foreground block">End Date</span><span className="font-medium">{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground block">Status</span><span className="font-medium">{project.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
              <div>
                <span className="text-muted-foreground block">Health</span>
                {latestHealth ? (
                  <Badge className={
                    latestHealth.health_status === "on_track" ? "bg-green-100 text-green-800" :
                    latestHealth.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }>
                    {latestHealth.health_status.replace(/_/g, " ")}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div><span className="text-muted-foreground block">Workflow</span><span className="font-medium">{workflowTemplate?.name || "—"}</span></div>
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

            <Separator className="my-6" />

            {/* Burndown Chart */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Burndown</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Scope:</label>
                  <Select value={burndownScope} onValueChange={setBurndownScope}>
                    <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      {phases.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const scopeTasks = burndownScope === "project"
                  ? (tasks || [])
                  : (tasks || []).filter((t: any) => t.phase_id === burndownScope);
                const estimated = scopeTasks.filter((t: any) => t.estimated_hours != null);
                const unestimated = scopeTasks.filter((t: any) => t.estimated_hours == null);
                const totalEst = estimated.reduce((s: number, t: any) => s + Number(t.estimated_hours), 0);
                const logged = scopeTasks.reduce((s: number, t: any) => {
                  const taskLogs = (logs || []).filter((l: any) => l.task_id === t.id);
                  return s + taskLogs.reduce((sum: number, l: any) => sum + Number(l.hours), 0);
                }, 0);
                const remaining = Math.max(0, totalEst - logged);
                const scopePhase = burndownScope !== "project" ? phases.find((p: any) => p.id === burndownScope) : null;
                const endDate = scopePhase?.due_date || project?.end_date;
                const startDate = project?.start_date;

                if (estimated.length === 0) {
                  return <p className="text-xs text-muted-foreground py-4">No estimated tasks to show burndown.</p>;
                }

                if (!endDate || !startDate) {
                  return <p className="text-xs text-muted-foreground py-4">Project needs start and end dates for burndown.</p>;
                }

                const daysTotal = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
                const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86400000));
                const idealPerDay = totalEst / daysTotal;
                const idealRemaining = Math.max(0, totalEst - idealPerDay * Math.min(daysElapsed, daysTotal));

                const burndownData = [
                  { name: "Start", ideal: totalEst, actual: totalEst },
                  { name: "Now", ideal: idealRemaining, actual: remaining },
                  { name: "Due", ideal: 0, actual: null },
                ];

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <span>Total estimated: <strong>{totalEst}h</strong></span>
                      <span>Logged: <strong>{logged.toFixed(1)}h</strong></span>
                      <span>Remaining: <strong>{remaining.toFixed(1)}h</strong></span>
                      {unestimated.length > 0 && (
                        <span className="text-yellow-600">Unestimated: <strong>{unestimated.length} task{unestimated.length > 1 ? "s" : ""}</strong></span>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={burndownData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="ideal" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Ideal" />
                        <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls name="Actual" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>

            <Separator className="my-6" />

            {/* Status Updates */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Status Updates</h3>
              {statusUpdatesLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : statusUpdates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status updates yet.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {statusUpdates.map((u: any) => (
                    <div key={u.id} className="flex gap-2 bg-muted/30 rounded-md p-3">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                        <AvatarFallback className="text-[10px]">{u.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), "MMM d, h:mm a")}</span>
                          {u.visible_to_client ? (
                            <Eye className="h-3 w-3 text-muted-foreground" title="Visible to client" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-muted-foreground" title="Internal only" />
                          )}
                        </div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{u.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-start">
                <Textarea
                  value={newStatusUpdate}
                  onChange={(e) => setNewStatusUpdate(e.target.value)}
                  placeholder="Post a status update..."
                  rows={2}
                  className="text-sm resize-none flex-1"
                />
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Checkbox id="status-update-visible" checked={newStatusUpdateVisible} onCheckedChange={(v) => setNewStatusUpdateVisible(v === true)} />
                    <label htmlFor="status-update-visible" className="text-[10px] cursor-pointer text-muted-foreground">Visible to client</label>
                  </div>
                  <Button type="button" size="sm" onClick={addStatusUpdate} disabled={!newStatusUpdate.trim()} className="shrink-0">Post</Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* RESOURCES — Admin: full management; Employee: view-only */}
        <TabsContent value="resources">
          <Card>
            <div className="p-4 flex justify-between items-center border-b">
              <span className="font-medium">{resourceMembers.length} resource{resourceMembers.length !== 1 ? "s" : ""}</span>
              {isAdmin && (
                <Button size="sm" onClick={() => { setAddMemberMode("resource"); setAddMemberOpen(true); }} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Resource</Button>
              )}
            </div>
            {resourceMembers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No resources assigned</div>
            ) : (
              <div>
                <TableHeader gridCols="1fr 112px 112px 80px">
                  <span>RESOURCE</span>
                  <span>HOURS SPENT</span>
                  <span>ASSIGNED</span>
                  <span className="text-right">ACTIONS</span>
                </TableHeader>
                {resourceMembers.sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || "")).map((m) => (
                  <DataRow key={m.id} gridCols="1fr 112px 112px 80px">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={getAvatarUrl((m.users as any)?.avatar_url)} />
                        <AvatarFallback className="text-xs">{((m.users as any)?.full_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <RowPrimary>{(m.users as any)?.full_name}</RowPrimary>
                        <RowSecondary>{(m.users as any)?.designation}</RowSecondary>
                      </div>
                    </div>
                    <RowDataItem label="HOURS SPENT">{m._hoursSpent}h</RowDataItem>
                    <RowDataItem label="ASSIGNED">{isAdmin ? format(new Date(m.assigned_at), "MMM d, yyyy") : "—"}</RowDataItem>
                    <RowActions className="justify-self-end">
                      {isAdmin && (
                        <button onClick={() => removeMember(m.id, (m.users as any)?.id)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </RowActions>
                  </DataRow>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* CLIENTS' MEMBER — Admin: full management; Employee: view-only */}
        <TabsContent value="clients">
          <Card>
            <div className="p-4 flex justify-between items-center border-b">
              <span className="font-medium">{clientMembers.length} Client Member{clientMembers.length !== 1 ? "s" : ""}</span>
              {isAdmin && (
                <Button size="sm" onClick={() => { setAddMemberMode("client"); setAddMemberOpen(true); }} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Client Member</Button>
              )}
            </div>
            <Table>
              <ShadcnTableHeader><TableRow>
                <TableHead>Name</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></ShadcnTableHeader>
              <TableBody>
                {clientMembers.sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || "")).map((m) => (
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
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m.id, (m.users as any)?.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {clientMembers.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 2 : 1} className="text-center text-muted-foreground py-8">No client members assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* STATS — all project members */}
        <TabsContent value="stats" className="space-y-6">
          {/* Health Summary */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Project Health</h3>
            {latestHealth ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Status</span>
                  <Badge className={
                    latestHealth.health_status === "on_track" ? "bg-green-100 text-green-800 mt-1" :
                    latestHealth.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800 mt-1" :
                    "bg-red-100 text-red-800 mt-1"
                  }>
                    {latestHealth.health_status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground block text-xs">Planned</span><span className="font-medium mt-1 block">{Number(latestHealth.planned_hours || 0).toFixed(1)}h</span></div>
                <div><span className="text-muted-foreground block text-xs">Logged</span><span className="font-medium mt-1 block">{Number(latestHealth.logged_hours || 0).toFixed(1)}h</span></div>
                <div><span className="text-muted-foreground block text-xs">Tasks</span><span className="font-medium mt-1 block">{latestHealth.tasks_complete}/{latestHealth.tasks_total}</span></div>
                <div><span className="text-muted-foreground block text-xs">Overdue</span><span className="font-medium mt-1 block">{latestHealth.tasks_overdue}</span></div>
                <div><span className="text-muted-foreground block text-xs">Blockers</span><span className="font-medium mt-1 block">{latestHealth.open_blockers}</span></div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Health data not yet available. Run the health compute job.</p>
            )}
          </Card>

          {/* Burndown (stats version) */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Burndown</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Scope:</label>
                <Select value={burndownScope} onValueChange={setBurndownScope}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Project</SelectItem>
                    {phases.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(() => {
              const scopeTasks = burndownScope === "project"
                ? (tasks || [])
                : (tasks || []).filter((t: any) => t.phase_id === burndownScope);
              const estimated = scopeTasks.filter((t: any) => t.estimated_hours != null);
              const unestimated = scopeTasks.filter((t: any) => t.estimated_hours == null);
              const totalEst = estimated.reduce((s: number, t: any) => s + Number(t.estimated_hours), 0);
              const logged = scopeTasks.reduce((s: number, t: any) => {
                const taskLogs = (logs || []).filter((l: any) => l.task_id === t.id);
                return s + taskLogs.reduce((sum: number, l: any) => sum + Number(l.hours), 0);
              }, 0);
              const scopePhase = burndownScope !== "project" ? phases.find((p: any) => p.id === burndownScope) : null;
              const endDate = scopePhase?.due_date || project?.end_date;
              const startDate = project?.start_date;
              if (estimated.length === 0 || !endDate || !startDate) {
                return <p className="text-xs text-muted-foreground">Burndown requires estimated tasks and project dates.</p>;
              }
              const daysTotal = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
              const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86400000));
              const idealPerDay = totalEst / daysTotal;
              const remaining = Math.max(0, totalEst - logged);
              const idealRemaining = Math.max(0, totalEst - idealPerDay * Math.min(daysElapsed, daysTotal));
              const bd = [
                { name: "Start", ideal: totalEst, actual: totalEst },
                { name: "Now", ideal: idealRemaining, actual: remaining },
                { name: "Due", ideal: 0, actual: null },
              ];
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Total: <strong>{totalEst}h</strong></span>
                    <span>Remaining: <strong>{remaining.toFixed(1)}h</strong></span>
                    {unestimated.length > 0 && <span className="text-yellow-600">{unestimated.length} unestimated</span>}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={bd}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="ideal" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Ideal" />
                      <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls name="Actual" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </Card>

          {/* Hours by Team Member */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Hours by Team Member</h3>
            {hoursByMember.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logged hours yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hoursByMember}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="hours" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Hours by Category */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Hours by Category</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logged hours yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Weekly Hours Trend */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Weekly Hours Trend</h3>
            {weeklyLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logged hours yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyLogs}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="hours" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} name="Hours" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Sprint Velocity */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Sprint Velocity</h3>
            {velocityData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No completed sprints yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                  <span>Sprints completed: <strong>{velocityData.length}</strong></span>
                  <span>Avg velocity: <strong>{avgVelocity.toFixed(1)} SP</strong></span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={velocityData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="committed" fill="#60a5fa" radius={[4, 4, 0, 0]} name="Committed" />
                    <Bar dataKey="velocity" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completed" />
                    <Bar dataKey="added" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Added mid-sprint" />
                  </BarChart>
                </ResponsiveContainer>
                {velocityData.length > 1 && (
                  <div className="text-xs text-muted-foreground">
                    Rolling avg: <strong>{avgVelocity.toFixed(1)} SP</strong> across last {velocityData.length} sprint{velocityData.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Admin-only reporting sections */}
          {isAdmin && (
            <>
              {/* Overdue Tasks */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Overdue Tasks</h3>
                {(() => {
                  const overdue = (tasks || []).filter((t: any) => {
                    if (!t.due_date) return false;
                    const ws = workflowStatuses?.find((s: any) => s.id === t.status_id);
                    return new Date(t.due_date) < new Date() && ws?.category !== "done";
                  });
                  if (overdue.length === 0) return <p className="text-xs text-muted-foreground">No overdue tasks.</p>;
                  return (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {overdue.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between bg-red-50 rounded-md p-2.5">
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{t.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              Due {format(new Date(t.due_date + "T00:00:00"), "MMM d")}
                              {t.estimated_hours && ` · ${t.estimated_hours}h est.`}
                            </span>
                          </div>
                          <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>

              {/* Blocker Stats */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Blocker Summary</h3>
                {projectBlockers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No blockers reported.</p>
                ) : (() => {
                  const openBlockers = projectBlockers.filter((b: any) => b.status === "open");
                  const resolvedBlockers = projectBlockers.filter((b: any) => b.status === "resolved");
                  const avgResolutionDays = resolvedBlockers.length > 0
                    ? resolvedBlockers.reduce((sum: number, b: any) => {
                        if (!b.resolved_at || !b.raised_at) return sum;
                        return sum + (new Date(b.resolved_at).getTime() - new Date(b.raised_at).getTime()) / 86400000;
                      }, 0) / resolvedBlockers.length
                    : null;
                  const blockersByMonth = Object.entries(
                    projectBlockers.reduce((acc: Record<string, number>, b: any) => {
                      const month = format(new Date(b.raised_at), "MMM yyyy");
                      acc[month] = (acc[month] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-6 text-sm">
                        <div><span className="text-muted-foreground text-xs block">Open</span><span className="font-medium">{openBlockers.length}</span></div>
                        <div><span className="text-muted-foreground text-xs block">Resolved</span><span className="font-medium">{resolvedBlockers.length}</span></div>
                        <div><span className="text-muted-foreground text-xs block">Avg resolution</span><span className="font-medium">{avgResolutionDays !== null ? `${avgResolutionDays.toFixed(1)}d` : "—"}</span></div>
                      </div>
                      {blockersByMonth.length > 1 && (
                        <ResponsiveContainer width="100%" height={150}>
                          <BarChart data={blockersByMonth}>
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ fontSize: 12 }} />
                            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  );
                })()}
              </Card>

              {/* Health Trend */}
              {healthTrend.length > 1 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Health Trend</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {healthTrend.map((s: any) => (
                      <Badge key={s.snapshot_date} className={
                        s.health_status === "on_track" ? "bg-green-100 text-green-800" :
                        s.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }>
                        {format(new Date(s.snapshot_date + "T00:00:00"), "MMM d")}
                      </Badge>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={healthTrend.map((s: any) => ({
                      date: format(new Date(s.snapshot_date + "T00:00:00"), "MMM d"),
                      score: s.health_status === "on_track" ? 3 : s.health_status === "at_risk" ? 2 : 1,
                    }))}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 4]} ticks={[1, 2, 3]} tickFormatter={(v) => v === 3 ? "On Track" : v === 2 ? "At Risk" : "Delayed"} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Health" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </>
          )}
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

              <div>
                {(() => {
                  const filtered = (logs || []).filter(l => !logFilterDate || l.log_date === logFilterDate);

                  if (filtered.length === 0) {
                    return <div className="py-12 text-center text-muted-foreground">No logs found for this date</div>;
                  }

                  return (
                      <>
                        <TableHeader gridCols="1fr 112px 80px 1fr">
                          <span>EMPLOYEE</span>
                          <span>DATE</span>
                          <span>HOURS</span>
                          <span>DESCRIPTION</span>
                        </TableHeader>
                        {filtered.map((log: any) => (
                          <DataRow key={log.id} gridCols="1fr 112px 80px 1fr">
                            <div>
                              <RowPrimary>{(log.users as any)?.full_name || "Unknown"}</RowPrimary>
                              <RowSecondary>{log.category}</RowSecondary>
                            </div>
                            <RowDataItem label="DATE">{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</RowDataItem>
                            <RowDataItem label="HOURS">{formatHours(Number(log.hours))}</RowDataItem>
                            <RowDataItem label="DESCRIPTION">
                              <p className="truncate">{log.description || "—"}</p>
                            </RowDataItem>
                          </DataRow>
                        ))}
                      </>
                    );
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
                  <div>
                    <TooltipProvider>
                      <TableHeader gridCols="1fr 96px 96px 96px 96px 80px">
                        <span>TASK</span>
                        <span>STATUS</span>
                        <span>EST. HOURS</span>
                        <span>PRIORITY</span>
                        <span>DUE DATE</span>
                        <span className="text-right">ACTIONS</span>
                      </TableHeader>
                      {myTasks.map((t: any) => (
                        <DataRow key={t.id} gridCols="1fr 96px 96px 96px 96px 80px">
                          <div>
                            <div className="flex items-center gap-2">
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
                              <RowPrimary className={t.status === "complete" ? "line-through text-muted-foreground" : ""}>
                                {t.title}
                                {criticalTaskIds.has(t.id) && <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">Critical Path</Badge>}
                                {t.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === t.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">{s.name}</Badge> : null; })()}
                                {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5" />}
                              </RowPrimary>
                            </div>
                            <RowSecondary>{t.description || "—"}</RowSecondary>
                          </div>
                          <RowBadgeItem label="STATUS"><Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge></RowBadgeItem>
                          <RowDataItem label="EST. HOURS">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</RowDataItem>
                          <RowBadgeItem label="PRIORITY">
                            <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}{t.story_points ? ` (${t.story_points})` : ""}</Badge>
                          </RowBadgeItem>
                          <RowDataItem label="DUE DATE">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</RowDataItem>
                          <RowActions className="justify-self-end">
                            <button onClick={() => setViewTaskData(t)} className={editButtonClass} title="View Details">
                              <Info className="h-4 w-4" />
                            </button>
                          </RowActions>
                        </DataRow>
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
                <div>
                  <TableHeader gridCols="1fr 112px 96px 96px 96px 96px 96px 96px 80px">
                    <span>TASK</span>
                    <span>ASSIGNED TO</span>
                    <span>PRIORITY</span>
                    <span>STATUS</span>
                    <span>EST. HOURS</span>
                    <span>DUE DATE</span>
                    <span>FLAGGED</span>
                    <span>VISIBLE</span>
                    <span className="text-right">ACTIONS</span>
                  </TableHeader>
                  {filteredTasks.map((t: any) => (
                  <DataRow key={t.id} gridCols="1fr 112px 96px 96px 96px 96px 96px 96px 80px">
                    <div>
                      <RowPrimary>
                        {t.title}
                        {criticalTaskIds.has(t.id) && <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">Critical Path</Badge>}
                        {t.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === t.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">{s.name}</Badge> : null; })()}
                        {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5 shrink-0" />}
                      </RowPrimary>
                      <RowSecondary>{t.description || "—"}</RowSecondary>
                    </div>
                    <RowDataItem label="ASSIGNED TO">{(t as any).users?.full_name || "—"}</RowDataItem>
                    <RowBadgeItem label="PRIORITY">
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}{t.story_points ? ` (${t.story_points})` : ""}</Badge>
                    </RowBadgeItem>
                    <RowBadgeItem label="STATUS"><Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge></RowBadgeItem>
                    <RowDataItem label="EST. HOURS">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</RowDataItem>
                    <RowDataItem label="DUE DATE">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</RowDataItem>
                    <RowBadgeItem label="FLAGGED">{t.is_flagged ? <Badge className="bg-red-100 text-red-700">Flagged</Badge> : <span className="text-[13px] text-[#374151]">—</span>}</RowBadgeItem>
                    <RowDataItem label="VISIBLE">
                      {t.client_visible !== false ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </RowDataItem>
                    <RowActions className="justify-self-end">
                      <button onClick={() => setViewTaskData(t)} className={editButtonClass} title="View Details">
                        <Info className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEditTask(t)} className={editButtonClass} title="Edit Task">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </RowActions>
                  </DataRow>
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
              <div>
                <TableHeader gridCols="1fr 96px 112px 192px 80px">
                  <span>PHASE</span>
                  <span>TASKS</span>
                  <span>DUE DATE</span>
                  <span>PROGRESS</span>
                  <span className="text-right">ACTIONS</span>
                </TableHeader>
                {phases.map((p: any) => (
                  <DataRow key={p.id} onClick={() => openPhaseTasks(p)} gridCols="1fr 96px 112px 192px 80px">
                    <div>
                      <RowPrimary>{p.title}</RowPrimary>
                      <RowSecondary>{phaseTaskCount[p.id] || 0} tasks</RowSecondary>
                    </div>
                    <RowDataItem label="TASKS">{phaseTaskCount[p.id] || 0}</RowDataItem>
                    <RowDataItem label="DUE DATE">{p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}</RowDataItem>
                    <RowDataItem label="PROGRESS">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${phaseProgress[p.id]}%` }} />
                        </div>
                        <span className="text-[11px] text-[#6b7280]">{phaseProgress[p.id]}%</span>
                      </div>
                    </RowDataItem>
                    <RowActions className="justify-self-end">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/projects/${slug}/phases/${p.id}`); }} className={editButtonClass} title="Edit Phase">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </RowActions>
                  </DataRow>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* SPRINTS — all project members */}
        <TabsContent value="sprints" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sprints</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setAddSprintOpen(true)} className="rounded-button bg-primary text-black hover:bg-black hover:text-white active:bg-black">
                <Plus className="h-4 w-4 mr-1" /> Add Sprint
              </Button>
            )}
          </div>
          {sprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sprints yet.</p>
          ) : (
            <div>
              <TableHeader gridCols="1fr 112px 96px 96px 96px 80px">
                <span>SPRINT</span>
                <span>DATES</span>
                <span>STATUS</span>
                <span>TASKS</span>
                <span>STORY PTS</span>
                <span className="text-right">ACTIONS</span>
              </TableHeader>
              {sprints.map((s: any) => (
                <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 96px 80px">
                  <div>
                    <RowPrimary>{s.name}</RowPrimary>
                    <RowSecondary>{sprintTaskCount[s.id] || 0} tasks</RowSecondary>
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
                  <RowDataItem label="TASKS">{sprintTaskCount[s.id] || 0}</RowDataItem>
                  <RowDataItem label="STORY PTS">{sprintSpTotal[s.id] || 0}</RowDataItem>
                  <RowActions className="justify-self-end">
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); openEditSprint(s); }} className={editButtonClass} title="Edit Sprint">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); deleteSprint(s.id); }} className={editButtonClass} title="Delete Sprint">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </RowActions>
                </DataRow>
              ))}
            </div>
          )}
        </TabsContent>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskDueDate && "text-muted-foreground")}>
                    {taskDueDate ? format(new Date(taskDueDate + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={taskDueDate ? new Date(taskDueDate + "T00:00:00") : undefined} onSelect={(d) => setTaskDueDate(d ? format(d, "yyyy-MM-dd") : "")} initialFocus />
                </PopoverContent>
              </Popover>
              {taskDueDate && <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setTaskDueDate("")}>Clear</button>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Story Points</label>
              <Input type="number" min="1" step="1" value={taskStoryPoints} onChange={(e) => setTaskStoryPoints(e.target.value)} placeholder="e.g. 3" />
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
              <Select value={taskSprintId} onValueChange={setTaskSprintId}>
                <SelectTrigger><SelectValue placeholder="Backlog" /></SelectTrigger>
                <SelectContent>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bulk Add Tasks</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">CSV Format</p>
              <p className="text-xs text-muted-foreground">Your CSV must have these column headers on the first row:</p>
              <div className="bg-muted rounded p-2 text-xs font-mono">title,description,priority,estimated_hours,due_date,story_points,client_visible</div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                <li><strong>title</strong> — required</li>
                <li><strong>description</strong> — optional</li>
                <li><strong>priority</strong> — must be one of: high, medium, low (case-insensitive, defaults to medium)</li>
                <li><strong>estimated_hours</strong> — optional decimal number (e.g. 1, 1.5, 2.25)</li>
                <li><strong>due_date</strong> — optional date (YYYY-MM-DD)</li>
                <li><strong>story_points</strong> — optional integer</li>
                <li><strong>client_visible</strong> — optional, true/false/yes/no (defaults to true)</li>
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
                        <th className="text-left p-2 font-medium">Due Date</th>
                        <th className="text-left p-2 font-medium">SP</th>
                        <th className="text-left p-2 font-medium">Visible</th>
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
                          <td className="p-2 text-muted-foreground">{r.due_date || "—"}</td>
                          <td className="p-2 text-muted-foreground">{r.story_points || "—"}</td>
                          <td className="p-2">{r.client_visible && !["false", "no", "0"].includes(r.client_visible) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}</td>
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
      <Dialog open={editTaskOpen} onOpenChange={(open) => {
        if (!open) {
          setNewComment("");
          setShowAddBlocker(false);
          setNewBlockerDescription("");
          setAddDepOpen(false);
          setAddDepTaskId("");
          setAddDepType("finish_to_start");
          setDependencyWarning("");
        }
        setEditTaskOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editTaskDueDate && "text-muted-foreground")}>
                    {editTaskDueDate ? format(new Date(editTaskDueDate + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editTaskDueDate ? new Date(editTaskDueDate + "T00:00:00") : undefined} onSelect={(d) => setEditTaskDueDate(d ? format(d, "yyyy-MM-dd") : "")} initialFocus />
                </PopoverContent>
              </Popover>
              {editTaskDueDate && <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditTaskDueDate("")}>Clear</button>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Story Points</label>
              <Input type="number" min="1" step="1" value={editTaskStoryPoints} onChange={(e) => setEditTaskStoryPoints(e.target.value)} placeholder="e.g. 3" />
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
              <Select value={editTaskSprintId} onValueChange={setEditTaskSprintId}>
                <SelectTrigger><SelectValue placeholder="Backlog" /></SelectTrigger>
                <SelectContent>
                  {sprints.filter((s: any) => s.status !== "completed").map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {workflowStatuses && workflowStatuses.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={editTaskStatusId} onValueChange={setEditTaskStatusId}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const allowed = (workflowTransitions && editTaskStatusId)
                        ? (() => {
                            const fromAllowed = getAllowedTransitions(workflowStatuses, workflowTransitions, editTaskStatusId);
                            const curr = workflowStatuses.find((s: any) => s.id === editTaskStatusId);
                            return curr && !fromAllowed.some((a: any) => a.id === curr.id)
                              ? [curr, ...fromAllowed] : fromAllowed;
                          })()
                        : workflowStatuses;
                      return allowed.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.name}</span>
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dependencyWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                <span className="font-medium">⚠ {dependencyWarning}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTaskOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>

          {/* Dependencies */}
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg> Dependencies</h4>
            {editDepsLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : editDeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dependencies.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {editDeps.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between bg-muted/30 rounded-md p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{d.depends_on?.title || "Unknown"}</span>
                      <Badge variant="outline" className="text-[10px]">{d.dependency_type.replace(/_/g, " ")}</Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDependency(d.id, editTaskId!)}
                      className="shrink-0 p-1 rounded hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600"
                      title="Remove dependency"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {addDepOpen ? (
              <div className="space-y-2 border rounded-md p-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Depends on</label>
                  <Select value={addDepTaskId} onValueChange={setAddDepTaskId}>
                    <SelectTrigger><SelectValue placeholder="Select task..." /></SelectTrigger>
                    <SelectContent>
                      {(tasks || [])
                        .filter((t: any) => t.id !== editTaskId)
                        .map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Dependency type</label>
                  <Select value={addDepType} onValueChange={setAddDepType}>
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
                  <Button type="button" size="sm" onClick={() => addDependency(editTaskId!)} disabled={!addDepTaskId}>Add</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setAddDepOpen(false); setAddDepTaskId(""); setAddDepForTaskId(null); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setAddDepOpen(true)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Dependency
              </Button>
            )}
          </div>

          {/* Comments */}
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</h4>
            {commentsLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-2 bg-muted/30 rounded-md p-2.5">
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarImage src={getAvatarUrl(c.author?.full_name)} />
                      <AvatarFallback className="text-[10px]">{c.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{c.author?.full_name || (c.author_type === "ai" ? "AI" : "Unknown")}</span>
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
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="text-sm resize-none"
              />
              <Button type="button" size="sm" onClick={() => addComment(editTaskId!)} disabled={!newComment.trim()} className="shrink-0 self-end">Comment</Button>
            </div>
          </div>

          {/* Blockers */}
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Blockers</h4>
            {blockersLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : blockers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No blockers reported.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {blockers.map((b: any) => (
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
                      <Button type="button" size="sm" variant="ghost" onClick={() => resolveBlocker(b.id, editTaskId!)} className="shrink-0 h-7 px-2" title="Resolve">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {showAddBlocker ? (
              <div className="space-y-2 border rounded-md p-3">
                <Textarea value={newBlockerDescription} onChange={(e) => setNewBlockerDescription(e.target.value)} placeholder="Describe the blocker..." rows={2} className="text-sm resize-none" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => addBlocker(editTaskId!, id!)} disabled={!newBlockerDescription.trim()}>Add</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowAddBlocker(false); setNewBlockerDescription(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBlocker(true)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Report Blocker
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Task Details Dialog */}
      <Dialog open={!!viewTaskData} onOpenChange={(open) => {
        if (!open) {
          setViewTaskData(null);
          setNewViewComment("");
          setShowViewAddBlocker(false);
          setNewViewBlockerDescription("");
          setViewAddDepOpen(false);
          setViewAddDepTaskId("");
          setViewAddDepType("finish_to_start");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTaskData?.title || "Task Details"}
              {viewTaskData?.is_flagged && <Flag className="h-4 w-4 text-red-500 shrink-0" />}
            </DialogTitle>
            {viewTaskData?.description && <p className="text-sm text-muted-foreground mt-1">{viewTaskData.description}</p>}
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mt-2">
            {viewTaskData?.priority && <Badge className={PRIORITY_COLORS[viewTaskData.priority] || ""}>{viewTaskData.priority}</Badge>}
            {viewTaskData?.status && <Badge className={TASK_STATUS_COLORS[viewTaskData.status] || ""}>{viewTaskData.status.replace(/_/g, " ")}</Badge>}
            {viewTaskData?.estimated_hours && <span className="text-xs text-muted-foreground">{viewTaskData.estimated_hours}h est.</span>}
            {viewTaskData?.story_points && <span className="text-xs text-muted-foreground">{viewTaskData.story_points} SP</span>}
            {viewTaskData?.due_date && <span className="text-xs text-muted-foreground">Due {format(new Date(viewTaskData.due_date + "T00:00:00"), "MMM d")}</span>}
            {viewTaskData?.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === viewTaskData.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.name}</Badge> : null; })()}
          </div>

          <Separator className="my-4" />

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
                        <span className="text-xs font-semibold">{c.author?.full_name || (c.author_type === "ai" ? "AI" : "Unknown")}</span>
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
                      onClick={() => removeDependency(d.id, viewTaskData?.id)}
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
                        .filter((t: any) => t.id !== viewTaskData?.id)
                        .map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
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
              <div className="space-y-2 border rounded-md p-3">
                <Textarea value={newViewBlockerDescription} onChange={(e) => setNewViewBlockerDescription(e.target.value)} placeholder="Describe the blocker..." rows={2} className="text-sm resize-none" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={addViewBlocker} disabled={!newViewBlockerDescription.trim()}>Add</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowViewAddBlocker(false); setNewViewBlockerDescription(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowViewAddBlocker(true)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Report Blocker
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member / Resource / Client Sheet */}
      <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <SheetContent className="flex flex-col h-full">
          <SheetHeader>
            <SheetTitle>
              {addMemberMode === "client" ? "Add Client Member" : "Add Resource"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={addMemberMode === "client" ? "Search client users..." : "Search resources..."}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {availableEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {memberSearch
                  ? "No matching users found."
                  : addMemberMode === "client"
                  ? "All client users are already on this project."
                  : "All resources are already on this project."}
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
            <Button onClick={addMembers} disabled={selectedUsers.length === 0} className="rounded-button w-full">
              Add {selectedUsers.length} {addMemberMode === "client" ? "Client Member" : "Resource"}{selectedUsers.length !== 1 ? "s" : ""}
            </Button>
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

      {/* Sprint Tasks Dialog */}
      <Dialog open={sprintTasksOpen} onOpenChange={setSprintTasksOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedSprint?.name} — Tasks</DialogTitle></DialogHeader>
          {(() => {
            const sprintTasks = (tasks || []).filter((t: any) => t.sprint_id === selectedSprint?.id);
            if (sprintTasks.length === 0) return <p className="text-sm text-muted-foreground py-4">No tasks assigned to this sprint.</p>;
            return (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sprintTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                      {(t as any).users?.full_name && <Badge variant="secondary" className="text-xs">{(t as any).users?.full_name}</Badge>}
                      {t.estimated_hours && <Badge variant="secondary" className="text-xs">{t.estimated_hours}h</Badge>}
                      {t.story_points && <Badge variant="secondary" className="text-xs">{t.story_points} SP</Badge>}
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Sprint Dialog */}
      <Dialog open={addSprintOpen} onOpenChange={setAddSprintOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sprint</DialogTitle></DialogHeader>
          <form onSubmit={createSprint} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="e.g. Sprint 1" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date *</label>
              <Input type="date" value={sprintStartDate} onChange={(e) => setSprintStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={sprintEndDate} onChange={(e) => setSprintEndDate(e.target.value)} required />
            </div>
            <Button type="submit" className="rounded-button w-full">Create Sprint</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sprint Dialog */}
      <Dialog open={editSprintOpen} onOpenChange={(open) => { if (!open) { setEditSprintOpen(false); setEditSprintId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Sprint</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSprintSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input value={editSprintName} onChange={(e) => setEditSprintName(e.target.value)} placeholder="Sprint name" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date *</label>
              <Input type="date" value={editSprintStartDate} onChange={(e) => setEditSprintStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={editSprintEndDate} onChange={(e) => setEditSprintEndDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editSprintStatus} onValueChange={setEditSprintStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditSprintOpen(false); setEditSprintId(null); }}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
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
