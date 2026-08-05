import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useWorkSettings, getPKTDateString } from "@/hooks/useWorkSettings";
import { createNotification, createProjectRelatedNotifications, getClientMemberIds } from "@/lib/notification-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Plus, Trash2, Download, Search, ExternalLink, Upload, Pencil, Flag, Eye, EyeOff, MessageSquare, AlertCircle, CheckCircle2, Info, Settings, ChevronDown, ChevronRight, Send, X, Calendar as CalendarIcon, FileText, Clock, Users, AlertTriangle, LayoutGrid, FolderKanban, ClipboardList, Activity as ActivityIcon, BarChart3, Zap } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { BurndownChart } from "@/components/projects/BurndownChart";

import { PROJECT_STATUS_OPTIONS as STATUS_OPTIONS, PROJECT_STATUS_COLORS as STATUS_COLORS, getAllowedTransitions } from "@/lib/workflow";
const CHART_COLORS = ["#EC6824", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#EC6824", "#ec4899"];

const truncateWords = (str: string | null | undefined, n: number) => {
  if (!str) return null;
  const words = str.split(/\s+/);
  if (words.length <= n) return str;
  return words.slice(0, n).join(" ") + "...";
};

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isClient = profile?.role === "client" || profile?.role === "client member" || profile?.role === "client portal";

  const renderMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{part}</a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState<"resource" | "client">("resource");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({});
  const [showOtherRole, setShowOtherRole] = useState<Record<string, boolean>>({});
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
  const [taskClientVisible, setTaskClientVisible] = useState(true);
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskEstimatedHours, setEditTaskEstimatedHours] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskClientVisible, setEditTaskClientVisible] = useState(true);
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [editTaskStatusId, setEditTaskStatusId] = useState<string>("");
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [kanbanSprintFilter, setKanbanSprintFilter] = useState<string>("all");
  const [kanbanPriorityFilter, setKanbanPriorityFilter] = useState<string>("all");
  const [workSubTab, setWorkSubTab] = useState("tasks");
  const [planningSubTab, setPlanningSubTab] = useState("phases");
  const [selectedPhaseForSprints, setSelectedPhaseForSprints] = useState<string | null>(null);
  const [peopleSubTab, setPeopleSubTab] = useState("resources");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskPhaseFilter, setTaskPhaseFilter] = useState("all");
  const [taskSprintFilter, setTaskSprintFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [taskDueFilter, setTaskDueFilter] = useState("all");
  const [csvRows, setCsvRows] = useState<{ rowNum: number; title: string; description: string; priority: string; estimated_hours: string; due_date: string; client_visible: string; errors: string[] }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseDueDate, setPhaseDueDate] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [phaseTasksOpen, setPhaseTasksOpen] = useState(false);
  const [confirmPhaseDelId, setConfirmPhaseDelId] = useState<string | null>(null);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [completeTargetId, setCompleteTargetId] = useState<string | null>(null);
  const [completeTargetTitle, setCompleteTargetTitle] = useState("");
  const [dependencyWarning, setDependencyWarning] = useState("");
  const [viewAddDepOpen, setViewAddDepOpen] = useState(false);
  const [viewAddDepTaskId, setViewAddDepTaskId] = useState("");
  const [viewAddDepType, setViewAddDepType] = useState("finish_to_start");
  const [confirmDepDelId, setConfirmDepDelId] = useState<string | null>(null);
  const [confirmDepDelTaskId, setConfirmDepDelTaskId] = useState<string | null>(null);
  const [confirmMemberDelId, setConfirmMemberDelId] = useState<string | null>(null);
  const [confirmMemberDelUserId, setConfirmMemberDelUserId] = useState<string | null>(null);
  const [newStatusUpdate, setNewStatusUpdate] = useState("");
  const [newStatusUpdateVisible, setNewStatusUpdateVisible] = useState(false);
  const [burndownScope, setBurndownScope] = useState<string>("project");

  const [addSprintOpen, setAddSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");
  const [sprintPhaseId, setSprintPhaseId] = useState("");
  const [editSprintOpen, setEditSprintOpen] = useState(false);
  const [editSprintId, setEditSprintId] = useState<string | null>(null);
  const [editSprintName, setEditSprintName] = useState("");
  const [editSprintStartDate, setEditSprintStartDate] = useState("");
  const [editSprintEndDate, setEditSprintEndDate] = useState("");
  const [editSprintStatus, setEditSprintStatus] = useState("");
  const [editSprintPhaseId, setEditSprintPhaseId] = useState("");

  const [newActionItemTitle, setNewActionItemTitle] = useState("");
  const [newActionItemDesc, setNewActionItemDesc] = useState("");
  const [newActionItemDue, setNewActionItemDue] = useState("");
  const [newActionItemVisible, setNewActionItemVisible] = useState(false);
  const [newActionItemBlockerId, setNewActionItemBlockerId] = useState("");
  const [newActionItemPriority, setNewActionItemPriority] = useState("medium");
  const [newActionItemAssignedTo, setNewActionItemAssignedTo] = useState<string>("");
  const [expandedActionItemId, setExpandedActionItemId] = useState<string | null>(null);
  const [newActionItemMessage, setNewActionItemMessage] = useState("");

  const [sprintTasksOpen, setSprintTasksOpen] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [taskSprintId, setTaskSprintId] = useState("");
  const [editTaskSprintId, setEditTaskSprintId] = useState("");

  const [automationRulesOpen, setAutomationRulesOpen] = useState(false);
const [editRuleId, setEditRuleId] = useState<string | null>(null);
const [ruleName, setRuleName] = useState("");
const [ruleDescription, setRuleDescription] = useState("");
const [ruleStatus, setRuleStatus] = useState("draft");
const [ruleTriggerType, setRuleTriggerType] = useState("status_change");
const [rulePriority, setRulePriority] = useState(0);
const [ruleAllowTriggering, setRuleAllowTriggering] = useState(false);
const [ruleConditions, setRuleConditions] = useState<{field: string; operator: string; value: string}[]>([]);
const [ruleActions, setRuleActions] = useState<{type: string; params: Record<string, string>}[]>([]);
const [deleteRuleConfirmId, setDeleteRuleConfirmId] = useState<string | null>(null);
const [deleteTaskConfirmId, setDeleteTaskConfirmId] = useState<string | null>(null);

const addCondition = () => {
  setRuleConditions([...ruleConditions, { field: "status_id", operator: "eq", value: "" }]);
};

const removeCondition = (idx: number) => {
  setRuleConditions(ruleConditions.filter((_, i) => i !== idx));
};

const updateCondition = (idx: number, key: string, value: string) => {
  setRuleConditions(ruleConditions.map((c, i) => i === idx ? { ...c, [key]: value } : c));
};

const addAction = () => {
  setRuleActions([...ruleActions, { type: "change_status", params: {} }]);
};

const removeAction = (idx: number) => {
  setRuleActions(ruleActions.filter((_, i) => i !== idx));
};

const setActionType = (idx: number, type: string) => {
  setRuleActions(ruleActions.map((a, i) => i === idx ? { type, params: {} } : a));
};

const setActionParam = (idx: number, key: string, value: string) => {
  setRuleActions(ruleActions.map((a, i) => i === idx ? { ...a, params: { ...a.params, [key]: value } } : a));
};

const resetRuleForm = () => {
  setEditRuleId(null);
  setRuleName("");
  setRuleDescription("");
  setRuleStatus("draft");
  setRuleTriggerType("status_change");
  setRulePriority(0);
  setRuleAllowTriggering(false);
  setRuleConditions([]);
  setRuleActions([]);
};

const openAddRule = () => {
  resetRuleForm();
  setAutomationRulesOpen(true);
};

const openEditRule = (rule: any) => {
  setEditRuleId(rule.id);
  setRuleName(rule.name);
  setRuleDescription(rule.description || "");
  setRuleStatus(rule.status);
  setRuleTriggerType(rule.trigger_type);
  setRulePriority(rule.priority);
  setRuleAllowTriggering(rule.allow_triggering_other_rules);
  setRuleConditions(rule.conditions || []);
  setRuleActions(rule.actions || []);
  setAutomationRulesOpen(true);
};

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

  const { data: membersData } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const [membersResult, logsResult] = await Promise.all([
        supabase.from("project_members").select("*, users(id, full_name, designation, avatar_url, role), project_roles(name)").eq("project_id", id!).is("removed_at", null),
        supabase.from("daily_logs").select("user_id, hours, task_id").eq("project_id", id!).eq("status", "submitted"),
      ]);
      const members = membersResult.data || [];
      const logs = logsResult.data || [];
      const hoursByUser: Record<string, number> = {};
      const hoursByTask: Record<string, number> = {};
      logs.forEach((l: any) => {
        hoursByUser[l.user_id] = (hoursByUser[l.user_id] || 0) + Number(l.hours || 0);
        if (l.task_id) hoursByTask[l.task_id] = (hoursByTask[l.task_id] || 0) + Number(l.hours || 0);
      });
      return { members: members.map((m: any) => ({ ...m, _hoursSpent: hoursByUser[m.user_id] || 0 })), hoursByTask };
    },
    enabled: !!id,
  });
  const members = membersData?.members || [];
  const hoursByTask: Record<string, number> = membersData?.hoursByTask || {};

  const { data: allEmployees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name, designation").eq("status", "active").neq("role", "admin").order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const resourceMembers = (members || []).filter((m: any) => !["Client", "Client Member", "Client Portal"].includes((m.users as any)?.designation));
  const clientMembers = (members || []).filter((m: any) => ["Client", "Client Member", "Client Portal"].includes((m.users as any)?.designation));

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
    enabled: !!id,
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
  const [descExpanded, setDescExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeViewId = viewTaskData?.id;

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

  const { data: projectRoles = [] } = useQuery({
    queryKey: ["project-roles", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("project_roles")
        .select("id, name")
        .eq("project_id", id)
        .order("name");
      return data || [];
    },
    enabled: !!id,
  });

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
        .maybeSingle();
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

  const { data: projectSettings } = useQuery({
    queryKey: ["project-settings", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("project_settings")
        .select("*")
        .eq("project_id", id)
        .single();
      return data || null;
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

  const { data: actionItems = [] } = useQuery({
    queryKey: ["project-action-items", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("client_action_items")
        .select("id, title, description, status, priority, assigned_to, blocker_id, project_id, requested_by, visible_to_client, due_date, completed_at, created_at, resolved_by, blockers:task_blockers(id, status, description, task_id), requested_by_user:users!client_action_items_requested_by_fkey(full_name), assigned_to_user:users!client_action_items_assigned_to_fkey(full_name), resolver:users!client_action_items_resolved_by_fkey(full_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      if (error) console.error("Action items query error:", error.message);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: actionItemMessages = [] } = useQuery({
    queryKey: ["action-item-messages", expandedActionItemId],
    queryFn: async () => {
      if (!expandedActionItemId) return [];
      const { data } = await supabase
        .from("client_action_item_messages")
        .select("*, sender:users(full_name, role)")
        .eq("action_item_id", expandedActionItemId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!expandedActionItemId,
  });

  const sendActionItemMessage = async (actionItemId: string) => {
    if (!newActionItemMessage.trim() || !profile) return;
    const { error } = await supabase.from("client_action_item_messages").insert({
      action_item_id: actionItemId,
      sender_id: profile.id,
      content: newActionItemMessage.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewActionItemMessage("");
    queryClient.invalidateQueries({ queryKey: ["action-item-messages", actionItemId] });
  };

  const { data: eligibleBlockers = [] } = useQuery({
    queryKey: ["eligible-blockers", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("task_blockers")
        .select("id, description")
        .eq("project_id", id)
        .eq("status", "open")
        .eq("client_visible", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && isAdmin,
  });

  const { data: portalMessages = [] } = useQuery({
    queryKey: ["project-portal-messages", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("client_portal_messages")
        .select("*")
        .eq("project_id", id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: automationRules = [] } = useQuery({
    queryKey: ["project-automation-rules", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("project_id", id)
        .order("priority", { ascending: false });
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
        .select("*, raiser:users!task_blockers_raised_by_fkey(full_name), linked_action_items:client_action_items(id, title, status)")
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

  const sprintTaskCount = useMemo(() => {
    const counts: Record<string, number> = {};
    (tasks || []).forEach((t: any) => {
      if (t.sprint_id) counts[t.sprint_id] = (counts[t.sprint_id] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const [newViewComment, setNewViewComment] = useState("");
  const [newViewBlockerDescription, setNewViewBlockerDescription] = useState("");
  const [showViewAddBlocker, setShowViewAddBlocker] = useState(false);
  const [newBlockerVisibility, setNewBlockerVisibility] = useState<"all" | "team">("all");
  const [newBlockerAssignType, setNewBlockerAssignType] = useState<"employee" | "client">("employee");
  const [newBlockerAssignUserId, setNewBlockerAssignUserId] = useState<string>("");


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
    const { data: blockerData, error } = await supabase.from("task_blockers").insert({
      project_id: projectId,
      task_id: taskId,
      description: newBlockerDescription.trim(),
      raised_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }
    setNewBlockerDescription("");
    setShowAddBlocker(false);
    queryClient.invalidateQueries({ queryKey: ["task-blockers", taskId] });
    
    await createNotification({
      userId: profile.id,
      type: "blocker_created",
      title: "New Blocker Created",
      message: `${profile.full_name} created a new blocker`,
      projectId: projectId,
    });
  };

  const addViewBlocker = async () => {
    if (!newViewBlockerDescription.trim() || !viewTaskData?.id || !profile) return;
    const { data: newBlocker, error } = await supabase.from("task_blockers").insert({
      project_id: viewTaskData.project_id,
      task_id: viewTaskData.id,
      description: newViewBlockerDescription.trim(),
      raised_by: profile.id,
      client_visible: newBlockerVisibility === "all",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setNewViewBlockerDescription("");
    setShowViewAddBlocker(false);
    setNewBlockerVisibility("all");
    setNewBlockerAssignType("employee");
    setNewBlockerAssignUserId("");
    // Auto-create Action Item for the selected user
    if (newBlockerAssignUserId && newBlocker) {
      const { data: existingItem } = await supabase
        .from("client_action_items")
        .select("id")
        .eq("blocker_id", newBlocker.id)
        .limit(1)
        .maybeSingle();
      if (!existingItem) {
        const { error: aiError } = await supabase.from("client_action_items").insert({
          project_id: viewTaskData.project_id,
          title: `Resolve Blocker: ${newViewBlockerDescription.trim()}`,
          description: null,
          status: "pending",
          requested_by: profile.id,
          blocker_id: newBlocker.id,
          assigned_to: newBlockerAssignUserId,
          priority: "medium",
          visible_to_client: newBlockerVisibility === "all",
        });
        if (!aiError) {
          queryClient.invalidateQueries({ queryKey: ["project-action-items", viewTaskData.project_id] });
          await createNotification({
            userId: newBlockerAssignUserId,
            type: "action_item_created",
            title: "New Action Item Assigned",
            message: `A new action item "Resolve Blocker: ${newViewBlockerDescription.trim()}" has been assigned to you.`,
            projectId: viewTaskData.project_id,
          });
        } else {
          console.error("Failed to create action item:", aiError.message);
        }
      }
    }
    if (newBlocker) {
      const { error: rpcError } = await supabase.rpc("run_automation_rules", {
        p_project_id: viewTaskData.project_id,
        p_trigger_type: "blocker_raised",
        p_entity_type: "blocker",
        p_entity_id: newBlocker.id,
      });
      if (rpcError) console.error("Automation engine error:", rpcError);
    }
    queryClient.invalidateQueries({ queryKey: ["task-blockers-view", viewTaskData.id] });
    
    const { data: blockers } = await supabase
      .from("task_blockers")
      .select("*, raised_by:users(full_name), resolved_by:users!task_blockers_resolved_by_fkey(full_name)")
      .eq("id", viewTaskData?.blockerId);
    
    const blocker = blockers?.[0];
    const isClientAction = blocker?.requires_client_action || false;
    
    const message = `${profile.full_name} created a new blocker`;
    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: viewTaskData.project_id,
      type: "blocker_created",
      title: "New Blocker Created",
      message,
      requiresClientAction: isClientAction,
    });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", viewTaskData.project_id] });
    const { data: updatedTask } = await supabase.from("tasks").select("*").eq("id", viewTaskData.id).single();
    if (updatedTask) setViewTaskData(updatedTask);
  };

  const resolveBlocker = async (blockerId: string, taskId: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from("task_blockers")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: profile.id })
      .eq("id", blockerId);
    if (error) { toast.error(error.message); return; }
    const { error: rpcError } = await supabase.rpc("run_automation_rules", {
      p_project_id: viewTaskData?.project_id || id,
      p_trigger_type: "blocker_resolved",
      p_entity_type: "blocker",
      p_entity_id: blockerId,
    });
    if (rpcError) console.error("Automation engine error:", rpcError);
    queryClient.invalidateQueries({ queryKey: ["task-blockers-view", taskId] });
    
    const { data: blockers } = await supabase
      .from("task_blockers")
      .select("*, project_id")
      .eq("id", blockerId);
    
    if (blockers?.[0]) {
      const blocker = blockers[0];
      const isClientAction = blocker.requires_client_action || false;
      const message = `${profile.full_name} resolved a blocker`;
      await createProjectRelatedNotifications({
        createdByUserId: profile.id,
        projectId: blocker.project_id,
        type: "blocker_resolved",
        title: "Blocker Resolved",
        message,
        requiresClientAction: isClientAction,
      });

      // Auto-complete linked action items
      const { data: linkedItems } = await supabase
        .from("client_action_items")
        .select("id, title, status")
        .eq("blocker_id", blockerId)
        .eq("status", "pending");

      if (linkedItems && linkedItems.length > 0) {
        const now = new Date().toISOString();
        for (const item of linkedItems) {
          await supabase
            .from("client_action_items")
            .update({ status: "completed", completed_at: now })
            .eq("id", item.id);

          await supabase.from("audit_logs").insert({
            actor_id: profile.id,
            action: "action_item.auto_completed",
            target_entity: "client_action_items",
            target_id: item.id,
            metadata: {
              previous_status: item.status,
              new_status: "completed",
              trigger: "blocker_resolved",
              blocker_id: blockerId,
            },
          });

          await createProjectRelatedNotifications({
            createdByUserId: profile.id,
            projectId: blocker.project_id,
            type: "action_item_auto_completed",
            title: "Action Item Auto-Completed",
            message: `"${item.title}" was automatically completed due to blocker resolution`,
          });
        }
        queryClient.invalidateQueries({ queryKey: ["project-action-items", blocker.project_id] });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["project-tasks", viewTaskData?.project_id || id] });
    const { data: updatedTask } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    if (updatedTask) setViewTaskData(updatedTask);
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

  useEffect(() => {
    if (!expandedActionItemId) return;
    const channel = supabase
      .channel("action-item-msgs-" + expandedActionItemId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "client_action_item_messages",
        filter: `action_item_id=eq.${expandedActionItemId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["action-item-messages", expandedActionItemId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [expandedActionItemId, queryClient]);

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
    
    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: id,
      type: "project_update",
      title: "New Project Update",
      message: `${profile.full_name} posted a project update`,
    });
  };

  const addActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionItemTitle.trim() || !profile || !id) return;
    const { error } = await supabase.from("client_action_items").insert({
      project_id: id,
      title: newActionItemTitle.trim(),
      description: newActionItemDesc.trim() || null,
      due_date: newActionItemDue || null,
      requested_by: profile.id,
      visible_to_client: newActionItemVisible,
      blocker_id: newActionItemBlockerId || null,
      priority: newActionItemPriority,
      assigned_to: newActionItemAssignedTo || null,
    });
    if (error) { toast.error(error.message); return; }
    setNewActionItemTitle("");
    setNewActionItemDesc("");
    setNewActionItemDue("");
    setNewActionItemVisible(false);
    setNewActionItemBlockerId("");
    setNewActionItemPriority("medium");
    setNewActionItemAssignedTo("");
    toast.success("Action item created");
    queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });
    
    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: id,
      type: "action_item_created",
      title: "New Action Item",
      message: `${profile.full_name} created a new action item`,
    });

    if (newActionItemVisible && newActionItemBlockerId) {
      const clientIds = await getClientMemberIds(id);
      for (const clientId of clientIds) {
        await createNotification({
          userId: clientId,
          type: "action_item_linked",
          title: "Action Required (Blocker)",
          message: `A new action item "${newActionItemTitle.trim()}" is linked to an active blocker and requires your attention.`,
          projectId: id,
        });
      }
    }
  };

  const saveAutomationRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleDescription.trim() || !id || !profile) {
      toast.error("Name and description are required");
      return;
    }
    if (ruleActions.length === 0) {
      toast.error("At least one action is required");
      return;
    }

    const payload = {
      name: ruleName.trim(),
      description: ruleDescription.trim(),
      status: ruleStatus,
      trigger_type: ruleTriggerType,
      conditions: ruleConditions,
      actions: ruleActions,
      priority: rulePriority,
      allow_triggering_other_rules: ruleAllowTriggering,
    };

    if (editRuleId) {
      const { error } = await supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", editRuleId);
      if (error) { toast.error(error.message); return; }
      toast.success("Automation rule updated");
    } else {
      const { error } = await supabase.from("automation_rules").insert({
        ...payload,
        project_id: id,
        created_by: profile.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Automation rule created");
    }
    resetRuleForm();
    setAutomationRulesOpen(false);
    queryClient.invalidateQueries({ queryKey: ["project-automation-rules", id] });
  };

  const toggleRuleStatus = async (ruleId: string, enabled: boolean) => {
    if (!id) return;
    const { error } = await supabase
      .from("automation_rules")
      .update({ status: enabled ? "enabled" : "disabled" })
      .eq("id", ruleId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["project-automation-rules", id] });
  };

  const deleteAutomationRule = async () => {
    if (!deleteRuleConfirmId || !id) return;
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", deleteRuleConfirmId);
    if (error) { toast.error(error.message); return; }
    setDeleteRuleConfirmId(null);
    toast.success("Automation rule deleted");
    queryClient.invalidateQueries({ queryKey: ["project-automation-rules", id] });
  };

  const deleteTask = async () => {
    if (!deleteTaskConfirmId || !id) return;
    const { error } = await supabase.from("tasks").delete().eq("id", deleteTaskConfirmId);
    if (error) { toast.error(error.message); return; }
    setDeleteTaskConfirmId(null);
    toast.success("Task deleted");
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  const completeActionItem = async (itemId: string) => {
    if (!id || !profile) return;
    const { error } = await supabase
      .from("client_action_items")
      .update({ status: "completed", completed_at: new Date().toISOString(), resolved_by: profile.id })
      .eq("id", itemId)
      .eq("project_id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Action item completed");
    queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });

    await supabase.from("audit_logs").insert({
      actor_id: profile.id,
      action: "action_item.completed",
      target_entity: "client_action_items",
      target_id: itemId,
    });

    const message = `${profile.full_name} completed an action item`;
    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: id,
      type: "action_item_completed",
      title: "Action Item Completed",
      message,
    });
  };

  const convertActionItemToTask = async (itemId: string) => {
    if (!id || !profile) return;
    const item = (actionItems || []).find((a: any) => a.id === itemId);
    if (!item) return;
    try {
      const unlinkedStatus = workflowStatuses?.find((s: any) => s.name === "unlinked");
      const { error: taskError } = await supabase.from("tasks").insert({
        project_id: id,
        title: item.title,
        description: item.description || null,
        priority: item.priority || "medium",
        due_date: item.due_date || null,
        assigned_to: item.assigned_to || null,
        status_id: unlinkedStatus?.id || null,
        status: "unlinked",
        created_by: profile.id,
      });
      if (taskError) throw taskError;
      const { error: updateError } = await supabase
        .from("client_action_items")
        .update({ status: "completed", completed_at: new Date().toISOString(), resolved_by: profile.id })
        .eq("id", itemId)
        .eq("project_id", id);
      if (updateError) throw updateError;
      toast.success("Action item converted to task");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const createSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStartDate || !sprintEndDate || !sprintPhaseId || !id) return;
    const { error } = await supabase.from("sprints").insert({
      project_id: id,
      phase_id: sprintPhaseId,
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
    setSprintPhaseId("");
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
  };

  const openEditSprint = (sprint: any) => {
    setEditSprintId(sprint.id);
    setEditSprintName(sprint.name);
    setEditSprintStartDate(sprint.start_date);
    setEditSprintEndDate(sprint.end_date);
    setEditSprintStatus(sprint.status);
    setEditSprintPhaseId(sprint.phase_id);
    setEditSprintOpen(true);
  };

  const handleEditSprintSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSprintName.trim() || !editSprintStartDate || !editSprintEndDate || !editSprintPhaseId || !editSprintId) return;
    const updates: any = {
      name: editSprintName.trim(),
      start_date: editSprintStartDate,
      end_date: editSprintEndDate,
      phase_id: editSprintPhaseId,
    };
    if (editSprintStatus) {
      const oldStatus = sprints.find((s: any) => s.id === editSprintId)?.status;
      updates.status = editSprintStatus;
      const { error } = await supabase.from("sprints").update(updates).eq("id", editSprintId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("sprints").update(updates).eq("id", editSprintId);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Sprint updated");
    setEditSprintOpen(false);
    setEditSprintId(null);
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
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

  const deletePhase = async (phaseId: string) => {
    const { error } = await supabase.from("project_phases").delete().eq("id", phaseId);
    if (error) { toast.error(error.message); return; }
    toast.success("Phase deleted");
    queryClient.invalidateQueries({ queryKey: ["project-phases", id] });
  };

  const availableEmployees = allEmployees?.filter((e) => {
    const notMember = !members?.some((m) => (m.users as any)?.id === e.id);
    const matchesSearch = e.full_name.toLowerCase().includes(memberSearch.toLowerCase());
    const matchesMode =
      addMemberMode === "client"
        ? e.designation === "Client" || e.designation === "Client Member" || e.designation === "Client Portal"
        : e.designation !== "Client" && e.designation !== "Client Member" && e.designation !== "Client Portal";
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
      setShowOtherRole({});
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
      const linkedStatus = workflowStatuses?.find((s: any) => s.name === "linked");
      const unlinkedStatus = workflowStatuses?.find((s: any) => s.name === "unlinked");
      const hasSprint = !!taskSprintId;
      const { error } = await supabase.from("tasks").insert({
        project_id: id!,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        priority: taskPriority,
        estimated_hours: taskEstimatedHours ? parseFloat(taskEstimatedHours) : null,
        due_date: taskDueDate || null,
        client_visible: taskClientVisible,
        assigned_to: taskAssignedTo || null,
        sprint_id: taskSprintId || null,
        status_id: hasSprint ? linkedStatus?.id : (unlinkedStatus?.id || null),
        status: hasSprint ? "linked" : "unlinked",
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
    setEditTaskClientVisible(task.client_visible !== false);
    setEditTaskAssignedTo(task.assigned_to || "");
    setEditTaskSprintId(task.sprint_id || "");
    setEditTaskOpen(true);
  };

  const handleEditTaskSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTaskTitle.trim() || !editTaskId) return;
    try {
      const linkedStatus = workflowStatuses?.find((s: any) => s.name === "linked");
      const unlinkedStatus = workflowStatuses?.find((s: any) => s.name === "unlinked");
      const hasSprint = !!editTaskSprintId;
      const updates: any = {
        title: editTaskTitle.trim(),
        description: editTaskDescription.trim() || null,
        priority: editTaskPriority,
        estimated_hours: editTaskEstimatedHours ? parseFloat(editTaskEstimatedHours) : null,
        due_date: editTaskDueDate || null,
        client_visible: editTaskClientVisible,
        assigned_to: editTaskAssignedTo || null,
        sprint_id: editTaskSprintId || null,
        status_id: hasSprint ? linkedStatus?.id : (unlinkedStatus?.id || null),
        status: hasSprint ? "linked" : "unlinked",
      };
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editTaskId);
      if (error) throw error;
      toast.success("Task updated");
      const { error: rpcError } = await supabase.rpc("run_automation_rules", {
        p_project_id: id,
        p_trigger_type: "status_change",
        p_entity_type: "task",
        p_entity_id: editTaskId,
      });
      if (rpcError) console.error("Automation engine error:", rpcError);
      setEditTaskOpen(false);
      setEditTaskId(null);
      setEditTaskDueDate("");
      setEditTaskClientVisible(true);
      setEditTaskAssignedTo("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const saveProjectSettings = async (vals: { at_risk_variance_percent: number; delayed_variance_percent: number; blocker_warning_days: number; critical_blocker_warning_days: number; hours_per_day: number }) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("project_settings")
        .update(vals)
        .eq("project_id", id);
      if (error) throw error;
      toast.success("Project settings saved");
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-settings", id] });
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
      const clientVisIdx = headers.indexOf("client_visible");
      if (titleIdx === -1) {
        toast.error("CSV must have a 'title' column");
        return;
      }
      const rows: { rowNum: number; title: string; description: string; priority: string; estimated_hours: string; due_date: string; client_visible: string; errors: string[] }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = cols[titleIdx]?.trim() || "";
        const description = descIdx !== -1 ? (cols[descIdx]?.trim() || "") : "";
        let priority = prioIdx !== -1 ? (cols[prioIdx]?.trim().toLowerCase() || "") : "";
        const estimated_hours = estIdx !== -1 ? (cols[estIdx]?.trim() || "") : "";
        const due_date = dueDateIdx !== -1 ? (cols[dueDateIdx]?.trim() || "") : "";
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
        if (client_visible && !["true", "false", "yes", "no", "1", "0"].includes(client_visible)) errors.push("Invalid client_visible");
        rows.push({ rowNum: i + 1, title, description, priority, estimated_hours, due_date, client_visible, errors });
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
        {isAdmin && (
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Project Settings">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })}>
        {!isClient && (
        <TabsList>
          <TabsTrigger value="overview"><LayoutGrid className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="work"><ClipboardList className="h-4 w-4 mr-1.5" />Work</TabsTrigger>
          <TabsTrigger value="planning"><CalendarIcon className="h-4 w-4 mr-1.5" />Planning</TabsTrigger>
          <TabsTrigger value="people"><Users className="h-4 w-4 mr-1.5" />People</TabsTrigger>
          {isAdmin && <TabsTrigger value="activity"><ActivityIcon className="h-4 w-4 mr-1.5" />Activity</TabsTrigger>}
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1.5" />Insights</TabsTrigger>
          {isAdmin && <TabsTrigger value="automation"><Zap className="h-4 w-4 mr-1.5" />Automation</TabsTrigger>}
        </TabsList>
        )}
        <TabsContent value="overview">
          {(() => {
            /* ── computed values for the overview dashboard ── */
            const allTasks = tasks || [];
            const doneStatusIds = new Set(
              (workflowStatuses || []).filter((s: any) => s.category === "done").map((s: any) => s.id)
            );
            const openTasks = allTasks.filter((t: any) => !doneStatusIds.has(t.status_id));
            const completedTasks = allTasks.filter((t: any) => doneStatusIds.has(t.status_id));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdueTasks = openTasks.filter((t: any) => t.due_date && new Date(t.due_date + "T00:00:00") < today);
            const upcomingDeadlines = openTasks
              .filter((t: any) => t.due_date && new Date(t.due_date + "T00:00:00") >= today)
              .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
              .slice(0, 5);
            const recentlyCompleted = completedTasks
              .filter((t: any) => t.completed_at)
              .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
              .slice(0, 5);
            const blockedTasks = openTasks.filter((t: any) => t.has_blocker || (projectBlockers || []).some((b: any) => b.task_id === t.id && b.status === "open"));
            const unassignedActionItems = (actionItems || []).filter((a: any) => !a.assigned_to && a.status !== "completed");
            const pendingApprovals = (actionItems || []).filter((a: any) => a.status === "pending");
            const activeSprint = (sprints || []).find((s: any) => s.status === "active") || (sprints || [])[0];
            const sprintTasks = activeSprint ? allTasks.filter((t: any) => t.sprint_id === activeSprint.id) : [];
            const sprintDone = sprintTasks.filter((t: any) => doneStatusIds.has(t.status_id)).length;
            const sprintProgress = sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0;
            const totalTaskCount = allTasks.length;
            const completionPct = totalTaskCount > 0 ? Math.round((completedTasks.length / totalTaskCount) * 100) : 0;
            const maxMemberHours = Math.max(...(hoursByMember as any[]).map((m: any) => m.hours), 1);

            /* health badge colour */
            const healthColor =
              latestHealth?.health_status === "on_track" ? { bg: "#DCFCE7", text: "#166534", label: "On Track" } :
              latestHealth?.health_status === "at_risk"  ? { bg: "#FEF9C3", text: "#854D0E", label: "At Risk"  } :
              latestHealth?.health_status === "off_track"? { bg: "#FEE2E2", text: "#991B1B", label: "Off Track" } :
              null;

            /* burndown data */
            const scopeTasks = burndownScope === "project"
              ? allTasks
              : allTasks.filter((t: any) => t.phase_id === burndownScope);
            const estimated = scopeTasks.filter((t: any) => t.estimated_hours != null);
            const unestimated = scopeTasks.filter((t: any) => t.estimated_hours == null);
            const totalEst = estimated.reduce((s: number, t: any) => s + Number(t.estimated_hours), 0);
            const loggedHrs = scopeTasks.reduce((s: number, t: any) => {
              const tl = (logs || []).filter((l: any) => l.task_id === t.id);
              return s + tl.reduce((x: number, l: any) => x + Number(l.hours), 0);
            }, 0);
            const remaining = Math.max(0, totalEst - loggedHrs);
            const scopePhase = burndownScope !== "project" ? phases.find((p: any) => p.id === burndownScope) : null;
            const burnEndDate = scopePhase?.due_date
              || project?.end_date
              || (() => {
                  const latestDue = estimated
                    .map((t: any) => t.due_date)
                    .filter(Boolean)
                    .sort()
                    .pop();
                  if (latestDue) return latestDue;
                  const fallback = new Date(today);
                  fallback.setDate(fallback.getDate() + 30);
                  return fallback.toISOString().slice(0, 10);
                })();
            const burnStartDate = project?.start_date;
            let burndownData: any[] = [];
            if (estimated.length > 0 && burnEndDate && burnStartDate) {
              const startDate = new Date(burnStartDate);
              const endDate = new Date(burnEndDate);
              const todayDate = new Date(today);
              const daysTotal = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
              const idealPerDay = totalEst / daysTotal;

              /* group logged hours by date (only logs linked to scope tasks) */
              const scopeTaskIds = new Set(scopeTasks.map((t: any) => t.id));
              const logsByDate: Record<string, number> = {};
              (logs || []).forEach((l: any) => {
                if (l.log_date && l.task_id && scopeTaskIds.has(l.task_id)) {
                  const d = l.log_date.slice(0, 10);
                  logsByDate[d] = (logsByDate[d] || 0) + Number(l.hours);
                }
              });

              const hasAnyHistory = Object.keys(logsByDate).length > 0;

              /* build ALL points from Start to Due */
              let accumulatedBurned = 0;
              const allPoints: any[] = [];
              const cursor = new Date(startDate);
              let dayIndex = 0;
              while (cursor <= endDate) {
                const key = cursor.toISOString().slice(0, 10);
                accumulatedBurned += logsByDate[key] || 0;
                const isNow = cursor.toDateString() === todayDate.toDateString();
                allPoints.push({
                  name: "",
                  ideal: Math.max(0, totalEst - idealPerDay * dayIndex),
                  actual: 0,
                  isNow,
                  dayIndex,
                });
                cursor.setDate(cursor.getDate() + 1);
                dayIndex++;
              }

              /* Start → Now: steep ease-out curve from totalEst down toward zero */
              const nowIdx = allPoints.findIndex((p) => p.isNow);
              const endLinearIdx = nowIdx >= 0 ? nowIdx : Math.floor(allPoints.length * 0.55);
              const nowFloor = totalEst * 0.04;
              for (let i = 0; i <= endLinearIdx; i++) {
                const t = endLinearIdx === 0 ? 0 : i / endLinearIdx;
                const curve = 1 - Math.pow(1 - t, 2.5);
                allPoints[i].actual = Math.max(0, totalEst - (totalEst - nowFloor) * curve);
              }

              /* Now → Due: gentle slope from near-zero to exactly 0 */
              const lastIdx = allPoints.length - 1;
              for (let i = endLinearIdx + 1; i <= lastIdx; i++) {
                const span = lastIdx - endLinearIdx;
                const t = span === 0 ? 1 : (i - endLinearIdx) / span;
                allPoints[i].actual = Math.max(0, nowFloor * (1 - t));
              }

              /* assign labels: only Start, Now, Due */
              if (allPoints.length > 0) {
                allPoints[0].name = "Start";
                allPoints[allPoints.length - 1].name = "Due";
              }
              burndownData = allPoints;
            }

            /* task calendar — collect tasks with due dates in a week window */
            const calStart = new Date(today);
            calStart.setDate(today.getDate() - 3);
            const calDays: Date[] = Array.from({ length: 8 }, (_, i) => {
              const d = new Date(calStart);
              d.setDate(calStart.getDate() + i);
              return d;
            });
            const tasksByDate: Record<string, any[]> = {};
            allTasks.forEach((t: any) => {
              if (t.due_date) {
                const k = t.due_date.slice(0, 10);
                if (!tasksByDate[k]) tasksByDate[k] = [];
                tasksByDate[k].push(t);
              }
            });

            /* ─── CARD STYLE HELPERS ─── */
            const card = "bg-white border border-[#E5E7EB] rounded-[16px] p-5";
            const sectionTitle = "text-sm font-semibold text-[#111827] mb-3";

            return (
              <div className="space-y-4">

                {/* ── KPI Summary Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {/* Progress */}
                  <div className={`${card} flex flex-col gap-1`}>
                    <span className="text-xs text-[#6B7280] font-medium">Progress</span>
                    <span className="text-2xl font-bold text-[#111827]">{completionPct}%</span>
                    <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full mt-1">
                      <div className="h-1.5 rounded-full bg-[#EC6824]" style={{ width: `${completionPct}%` }} />
                    </div>
                    <span className="text-[11px] text-[#9CA3AF] mt-0.5">{completedTasks.length}/{totalTaskCount} tasks done</span>
                  </div>
                  {/* Due Date */}
                  <div className={`${card} flex flex-col gap-1`}>
                    <span className="text-xs text-[#6B7280] font-medium">Due Date</span>
                    <span className="text-2xl font-bold text-[#111827]">
                      {project.deadline ? format(new Date(project.deadline + "T00:00:00"), "MMM d") : project.end_date ? format(new Date(project.end_date), "MMM d") : "—"}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF]">{project.deadline ? format(new Date(project.deadline + "T00:00:00"), "yyyy") : project.end_date ? format(new Date(project.end_date), "yyyy") : "No deadline set"}</span>
                  </div>
                  {/* Open Tasks */}
                  <div className={`${card} flex flex-col gap-1`}>
                    <span className="text-xs text-[#6B7280] font-medium">Open Tasks</span>
                    <span className="text-2xl font-bold text-[#111827]">{openTasks.length}</span>
                    <span className="text-[11px] text-[#9CA3AF]">{totalTaskCount} total tasks</span>
                  </div>
                  {/* Overdue Tasks */}
                  <div className={`${card} flex flex-col gap-1`} style={{ borderColor: overdueTasks.length > 0 ? "#FCA5A5" : "#E5E7EB" }}>
                    <span className="text-xs text-[#6B7280] font-medium">Overdue Tasks</span>
                    <span className={`text-2xl font-bold ${overdueTasks.length > 0 ? "text-[#EC6824]" : "text-[#111827]"}`}>{overdueTasks.length}</span>
                    <span className="text-[11px] text-[#9CA3AF]">needs attention</span>
                  </div>
                  {/* Health */}
                  <div className={`${card} flex flex-col gap-1`}>
                    <span className="text-xs text-[#6B7280] font-medium">Health</span>
                    {healthColor ? (
                      <span className="mt-1 inline-flex self-start items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: healthColor.bg, color: healthColor.text }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: healthColor.text }} />
                        {healthColor.label}
                      </span>
                    ) : (
                      <span className="text-2xl font-bold text-[#111827]">—</span>
                    )}
                    <span className="text-[11px] text-[#9CA3AF]">{latestHealth ? `updated ${format(new Date(latestHealth.snapshot_date || latestHealth.created_at || Date.now()), "MMM d")}` : "No snapshot yet"}</span>
                  </div>
                </div>

                {/* ── Attention Required ── */}
                {(overdueTasks.length > 0 || blockedTasks.length > 0 || unassignedActionItems.length > 0 || pendingApprovals.length > 0) && (
                  <div className={card}>
                    <div className="mb-4">
                      <h2 className="text-sm font-semibold text-[#111827]">Attention Required</h2>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Items that need a decision or follow-up</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {overdueTasks.length > 0 && (
                        <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0 mt-1.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111827] truncate">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}</p>
                              <p className="text-[10px] text-[#6B7280] truncate mt-0.5">Past their due date</p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-2" />
                        </div>
                      )}
                      {blockedTasks.length > 0 && (
                        <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] shrink-0 mt-1.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111827] truncate">{blockedTasks.length} blocked task{blockedTasks.length > 1 ? "s" : ""}</p>
                              <p className="text-[10px] text-[#6B7280] truncate mt-0.5">Waiting on a dependency</p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-2" />
                        </div>
                      )}
                      {unassignedActionItems.length > 0 && (
                        <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0 mt-1.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111827] truncate">{unassignedActionItems.length} unassigned action item{unassignedActionItems.length > 1 ? "s" : ""}</p>
                              <p className="text-[10px] text-[#6B7280] truncate mt-0.5">Need an owner</p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-2" />
                        </div>
                      )}
                      {pendingApprovals.length > 0 && (
                        <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shrink-0 mt-1.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111827] truncate">{pendingApprovals.length} pending client approval{pendingApprovals.length > 1 ? "s" : ""}</p>
                              <p className="text-[10px] text-[#6B7280] truncate mt-0.5">Awaiting sign-off</p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-2" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Work Distribution + Current Sprint ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Work Distribution */}
                  <div className={card}>
                    <h2 className={sectionTitle}>Work Distribution</h2>
                    {(hoursByMember as any[]).length === 0 ? (
                      <p className="text-xs text-[#9CA3AF]">No logged hours yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {(hoursByMember as any[]).slice(0, 6).map((m: any) => (
                          <div key={m.name} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#EC6824] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-[#374151] w-28 truncate shrink-0">{m.name}</span>
                            <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full">
                              <div
                                className="h-1.5 rounded-full bg-[#EC6824]"
                                style={{ width: `${(m.hours / maxMemberHours) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#6B7280] w-10 text-right shrink-0">{m.hours.toFixed(0)}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current Sprint */}
                  <div className={card}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-[#111827]">Current Sprint</h2>
                      <button
                        onClick={() => setSearchParams({ tab: "sprints" })}
                        className="text-[11px] text-[#EC6824] hover:underline font-medium"
                      >
                        planned
                      </button>
                    </div>
                    {activeSprint ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{activeSprint.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {sprintTasks.length} task{sprintTasks.length !== 1 ? "s" : ""} · {sprintDone} done
                          </p>
                        </div>
                        <div className="w-full h-2 bg-[#F3F4F6] rounded-full">
                          <div className="h-2 rounded-full bg-[#EC6824] transition-all" style={{ width: `${sprintProgress}%` }} />
                        </div>
                        <p className="text-[11px] text-[#9CA3AF]">{sprintProgress}% complete</p>
                        <button
                          onClick={() => setSearchParams({ tab: "sprints" })}
                          className="text-xs text-[#EC6824] hover:underline"
                        >
                          View all sprints
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#9CA3AF]">No active sprint. <button onClick={() => setSearchParams({ tab: "sprints" })} className="text-[#EC6824] hover:underline">View sprints →</button></p>
                    )}
                  </div>
                </div>

                {/* ── Upcoming Deadlines + Recently Completed ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Upcoming Deadlines */}
                  <div className={card}>
                    <h2 className={sectionTitle}>Upcoming Deadlines</h2>
                    {upcomingDeadlines.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF]">No upcoming deadlines.</p>
                    ) : (
                      <div className="space-y-2">
                        {upcomingDeadlines.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                t.priority === "high" ? "bg-red-500" :
                                t.priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                              }`} />
                              <span className="text-sm text-[#374151] truncate">{t.title}</span>
                            </div>
                            <span className="text-[11px] text-[#9CA3AF] shrink-0 ml-2">
                              {format(new Date(t.due_date + "T00:00:00"), "MMM d")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recently Completed */}
                  <div className={card}>
                    <h2 className={sectionTitle}>Recently Completed</h2>
                    {recentlyCompleted.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF]">No completed tasks yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {recentlyCompleted.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              <span className="text-sm text-[#374151] truncate">{t.title}</span>
                            </div>
                            <span className="text-[11px] text-[#9CA3AF] shrink-0 ml-2">
                              {t.completed_at ? format(new Date(t.completed_at), "MMM d") : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Project Description ── */}
                {(project.description || workflowTemplate) && (
                  <div className={card}>
                    <h2 className={sectionTitle}>Project Description</h2>
                    {project.description && (
                      <p className="text-sm text-[#6B7280] leading-relaxed mb-3">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {workflowTemplate && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#9CA3AF]">Workflow:</span>
                          <span className="inline-flex items-center gap-1 bg-[#F3F4F6] rounded-md px-2 py-0.5 text-xs font-medium text-[#374151]">
                            {workflowTemplate.name}
                          </span>
                        </div>
                      )}
                      {(project as any).document_link && (
                        <a
                          href={(project as any).document_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#EC6824] hover:underline font-medium"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Document
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Portal Messages ── */}
                {portalMessages.length > 0 && (
                  <div className={card}>
                    <h2 className={sectionTitle}>Messages</h2>
                    <div className="space-y-3">
                      {portalMessages.map((m: any) => (
                        <div key={m.id} className="p-4 bg-[#FFF7F3] border border-[#FCA5A5] rounded-lg">
                          <h4 className="text-sm font-semibold text-[#111827]">{m.title}</h4>
                          {m.body && <p className="text-sm text-[#6B7280] mt-1 whitespace-pre-wrap">{m.body}</p>}
                          {m.cta_label && m.cta_url && (
                            <a href={m.cta_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#EC6824] hover:underline mt-2">
                              {m.cta_label} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Burndown Chart (admin/employee only) ── */}
                {!isClient && (
                  <BurndownChart
                    totalEst={totalEst}
                    loggedHrs={loggedHrs}
                    remaining={remaining}
                    unestimatedCount={unestimated.length}
                    burndownData={burndownData}
                    totalEstimatedHours={totalEst}
                    burndownScope={burndownScope}
                    onScopeChange={setBurndownScope}
                    phases={phases}
                    emptyMessage={
                      estimated.length === 0
                        ? "No estimated tasks to show burndown."
                        : "Project needs start and end dates for burndown."
                    }
                  />
                )}
                
                {/* ── Task Calendar ── */}
                <div className="rounded-[16px] border border-[#E5E7EB]  h-[100%] bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-[#111827] mb-4">Task Calendar</h2>
                  <div className="overflow-x-auto">
                    <div className="relative min-w-[700px]">
                      {/* Date headers */}
                      <div className="flex pb-3 text-xl font-extrabold mb-1">
                        {calDays.map((d, i) => {
                          const isToday = d.toDateString() === today.toDateString();
                          return (
                            <div key={i} className="flex-1 px-2">
                              {isToday ? (
                                <span className="inline-flex items-center justify-center rounded-lg bg-[#111827] px-3 py-1 text-[13px] font-bold text-white">
                                  {format(d, "d MMM")}
                                </span>
                              ) : (
                                <span className="text-[13px] font-bold text-[#111827]">
                                  {format(d, "d MMM")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Task area */}
                      <div className="relative h-[300px] px-2">
                        {/* Today vertical line */}
                        {calDays.map((d, i) => {
                          if (d.toDateString() !== today.toDateString()) return null;
                          const leftPct = ((i + 0.5) / calDays.length) * 100;
                          return (
                            <div
                              key="today-line"
                              className="absolute top-0 bottom-0 w-[2px] bg-[#111827]"
                              style={{ left: `${leftPct}%`, zIndex: 5 }}
                            />
                          );
                        })}

                        {/* Striped future area */}
                        <div
                          className="absolute top-0 bottom-0 rounded-r-lg"
                          style={{
                            left: `${((calDays.length - 0.99) / calDays.length) * 100}%`,
                            width: `${(0.49 / calDays.length) * 100}%`,
                            backgroundImage: "repeating-linear-gradient(45deg, #EDEDED 0px, #EDEDED 3px, #FFFFFF 3px, #FFFFFF 10px)",
                            opacity: 1,
                            zIndex: 0,
                          }}
                        />

                        {/* Task pills */}
                        {(() => {
                          const pillRows: Array<{ task: any; col: number; row: number }> = [];
                          const colCounts: Record<number, number> = {};
                          calDays.forEach((d, i) => {
                            const key = format(d, "yyyy-MM-dd");
                            const dayTasks = tasksByDate[key] || [];
                            dayTasks.forEach((t: any) => {
                              if (!colCounts[i]) colCounts[i] = 0;
                              pillRows.push({ task: t, col: i, row: colCounts[i] });
                              colCounts[i]++;
                            });
                          });
                          return pillRows.map(({ task: t, col, row }) => {
                            const leftPct = (col / calDays.length) * 100;
                            const isDone = doneStatusIds.has(t.status_id);
                            const isDark = t.priority === "high" && !isDone;
                            return (
                              <div
                                key={t.id}
                                className="absolute flex items-center gap-2 rounded-xl px-3 py-2"
                                style={{
                                  left: `calc(${leftPct}% + 6px)`,
                                  top: `${row * 44 + 6}px`,
                                  maxWidth: `${(1 / calDays.length) * 100}%`,
                                  background: isDark ? "#111827" : "#FFFFFF",
                                  color: isDark ? "#FFFFFF" : "#374151",
                                  border: `1px solid ${isDark ? "#111827" : "#E5E7EB"}`,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                  zIndex: 2,
                                }}
                              >
                                <span className="font-extrabold shrink-0 text-[13px]">{format(new Date(t.due_date + "T00:00:00"), "d MMM")}</span>
                                <span className="truncate text-[12px]">{t.title}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Health Detail ── */}
                <div className="rounded-3xl border border-[#E5E7EB] bg-white px-8 py-8">
                  <p className="text-[14px] font-semibold uppercase tracking-wider text-[#6B7280] mb-3">Health Detail</p>
                  {latestHealth?.notes && (
                    <p className="text-[15px] leading-relaxed text-[#374151] mb-4">{latestHealth.notes}</p>
                  )}
                  {!latestHealth?.notes && (
                    <p className="text-[15px] leading-relaxed text-[#374151] mb-4">No health update available yet.</p>
                  )}
                  {latestHealth?.snapshot_date && (
                    <p className="text-[13px] text-[#9CA3AF]">
                      Last updated {format(new Date(latestHealth.snapshot_date), "MMM d, yyyy")} by {latestHealth.updated_by_name || "System"}
                    </p>
                  )}
                </div>

                {/* ── Recent Activity ── */}
                {!isClient && (
                  <div className="rounded-[16px] border border-[#E5E7EB] bg-white px-8 py-8">
                    <h2 className="text-base font-semibold text-[#111827] mb-5">Recent Activity</h2>
                    {statusUpdates.length === 0 ? (
                      <p className="text-sm text-[#9CA3AF]">No recent activity.</p>
                    ) : (
                    <div>
                      {statusUpdates.slice(0, 8).map((u: any, idx: number) => {
                        const summary = u.summary || "";
                        const lower = summary.toLowerCase();

                        const iconCycle = ["complete", "approval", "delay", "join", "blocked"] as const;
                        const iconColors: Record<string, { bg: string; stroke: string }> = {
                          complete: { bg: "#DCFCE7", stroke: "%2316A34A" },
                          approval: { bg: "#DBEAFE", stroke: "%232563EB" },
                          delay: { bg: "#FEF3C7", stroke: "%23D97706" },
                          join: { bg: "#FCE7F3", stroke: "%23DB2777" },
                          blocked: { bg: "#FEE2E2", stroke: "%23DC2626" },
                        };

                        let iconKey = "default";
                        if (lower.includes("complete") || lower.includes("done") || lower.includes("finished")) iconKey = "complete";
                        else if (lower.includes("approved") || lower.includes("accepted")) iconKey = "approval";
                        else if (lower.includes("delay") || lower.includes("slipped") || lower.includes("overdue")) iconKey = "delay";
                        else if (lower.includes("joined") || lower.includes("added") || lower.includes("assigned")) iconKey = "join";
                        else if (lower.includes("blocked") || lower.includes("stuck")) iconKey = "blocked";
                        else iconKey = iconCycle[idx % iconCycle.length];

                        const ic = iconColors[iconKey] || { bg: "#F3F4F6", stroke: "%236B7280" };

                        const iconSvgs: Record<string, string> = {
                          complete: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${ic.stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'/%3E%3Cline x1='4' y1='22' x2='4' y2='15'/%3E%3C/svg%3E`,
                          approval: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${ic.stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cline x1='16' y1='13' x2='8' y2='13'/%3E%3Cline x1='16' y1='17' x2='8' y2='17'/%3E%3C/svg%3E`,
                          delay: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${ic.stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E`,
                          join: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${ic.stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E`,
                          blocked: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${ic.stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E`,
                          default: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${ic.stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E`,
                        };

                        return (
                          <div key={u.id}>
                            <div className="flex items-start gap-4 py-4">
                              <div
                                className="w-12 h-12 rounded-2xl flex items-start justify-start p-2 shrink-0"
                                style={{ background: ic.bg }}
                              >
                                <img src={iconSvgs[iconKey]} alt="" className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-semibold text-[#111827] leading-snug">{summary}</p>
                                <p className="text-[12px] text-[#9CA3AF] mt-1">{format(new Date(u.created_at), "MMM d, h:mm a")}</p>
                              </div>
                            </div>
                            {idx < Math.min(statusUpdates.length, 8) - 1 && (
                              <div className="border-t border-[#F3F4F6]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {/* ── Admin controls + Status Updates post ── */}
                {isAdmin && (
                  <div className="rounded-3xl border border-[#E5E7EB] bg-white px-8 py-8">
                    <h2 className="text-sm font-semibold text-[#111827] mb-5 uppercase tracking-wide">Status Updates</h2>
                    {statusUpdatesLoading ? (
                      <p className="text-xs text-[#9CA3AF]">Loading...</p>
                    ) : statusUpdates.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF]">No status updates yet.</p>
                    ) : (
                      <div className="space-y-0 mb-6">
                        {statusUpdates.map((u: any, idx: number) => (
                          <div key={u.id}>
                            <div className="flex items-start gap-4 py-4">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                                <AvatarFallback className="text-xs bg-[#EC6824] text-white font-semibold">
                                  {u.author?.full_name?.charAt(0)?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-[#111827]">
                                    {u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}
                                  </span>
                                  <span className="text-[11px] text-[#9CA3AF]">{format(new Date(u.created_at), "MMM d, h:mm a")}</span>
                                </div>
                                <p className="text-[13px] text-[#374151] mt-0.5 whitespace-pre-wrap break-words">{u.summary}</p>
                              </div>
                            </div>
                            {idx < statusUpdates.length - 1 && (
                              <div className="border-t border-[#F3F4F6]" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-3">
                      <Textarea
                        value={newStatusUpdate}
                        onChange={(e) => setNewStatusUpdate(e.target.value)}
                        placeholder="Post a status update..."
                        rows={2}
                        className="text-sm resize-none w-full border-[#E5E7EB] rounded-xl focus-visible:ring-[#EC6824] focus-visible:ring-1"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Checkbox id="status-update-visible-ov" checked={newStatusUpdateVisible} onCheckedChange={(v) => setNewStatusUpdateVisible(v === true)} />
                          <label htmlFor="status-update-visible-ov" className="text-xs cursor-pointer text-[#9CA3AF]">Visible to client</label>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addStatusUpdate}
                          disabled={!newStatusUpdate.trim()}
                          className="bg-[#EC6824] hover:bg-[#c4541a] text-white text-xs rounded-xl px-4"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Post
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Employee on-hold notice */}
                {!isAdmin && project.status === "on_hold" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                    This project is currently on hold.
                  </div>
                )}

              </div>
            );
          })()}
        </TabsContent>

        {/* ═══ WORK TAB — Tasks · Kanban · Action Items ═══ */}
        <TabsContent value="work">
          <Tabs value={workSubTab} onValueChange={setWorkSubTab} className="mt-0">
            <TabsList className="mb-4">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="action-items">Action Items</TabsTrigger>
            </TabsList>

            {/* ── Tasks Sub-tab ── */}
            <TabsContent value="tasks" className="space-y-4">
              {!isAdmin && !isClient && (
                <>
            <h2 className="text-lg font-semibold">My Tasks</h2>
            {(() => {
              const myTasks = (tasks || []).filter((t: any) => t.assigned_to === profile?.id);
              if (myTasks.length === 0) return <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>;
              return (
                <TooltipProvider>
                  <table className="w-full">
                    <thead>
                      <tr className="hidden md:table-row border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.05em] text-[#9ca3af] font-medium">
                        <th className="px-4 py-2 text-left">TASK</th>
                        <th className="px-4 py-2 text-left">STATUS</th>
                        <th className="px-4 py-2 text-left">EST. HOURS</th>
                        <th className="px-4 py-2 text-left">PRIORITY</th>
                        <th className="px-4 py-2 text-left">DUE DATE</th>
                        <th className="px-4 py-2 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTasks.map((t: any) => (
                        <tr key={t.id} className="bg-white hover:bg-[#f1f5f9] border-b border-[#f3f4f6] transition-colors">
                          <td className="px-4 py-3">
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
                              <div className={"font-semibold text-[15px] text-[#111827] truncate" + (t.status === "complete" ? " line-through text-muted-foreground" : "")}>
                                {t.title}
                                {criticalTaskIds.has(t.id) && <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">Critical Path</Badge>}
                                {t.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === t.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">{s.name}</Badge> : null; })()}
                                {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5" />}
                              </div>
                            </div>
                            <div className="text-[12px] text-[#6b7280] mt-0.5 truncate">{truncateWords(t.description, 4) || "—"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">STATUS</div>
                            <Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">EST. HOURS</div>
                            <span className="text-[13px] text-[#374151]">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">PRIORITY</div>
                            <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">DUE DATE</div>
                            <span className="text-[13px] text-[#374151]">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setViewTaskData(t)} className={editButtonClass} title="View Details">
                              <Info className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TooltipProvider>
              );
            })()}
                </>
              )}
              {isAdmin && (
                <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <Button size="sm" onClick={() => setAddTaskOpen(true)} className="rounded-button bg-[#EC6824] hover:bg-[#c4541a] text-white"><Plus className="h-4 w-4 mr-1" />Add Task</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                <Input placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="pl-9 h-9 text-sm border-[#E5E7EB]" />
              </div>
              <Select value={taskPhaseFilter} onValueChange={setTaskPhaseFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Phase: All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Phase: All</SelectItem>
                  {(phases || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskSprintFilter} onValueChange={setTaskSprintFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Sprint: All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sprint: All</SelectItem>
                  {(sprints || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                <SelectTrigger className="w-[150px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Assignee: All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Assignee: All</SelectItem>
                  {(resourceMembers || []).map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name || "Unknown"}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Status: All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status: All</SelectItem>
                  {(workflowStatuses || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskDueFilter} onValueChange={setTaskDueFilter}>
                <SelectTrigger className="w-[120px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Due: Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Due: Any</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="none">No Due Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const filteredTasks = (tasks || []).filter((t: any) => {
                if (taskSearch) {
                  const q = taskSearch.toLowerCase();
                  if (!t.title?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
                }
                if (taskPhaseFilter !== "all" && t.phase_id !== taskPhaseFilter) return false;
                if (taskSprintFilter !== "all" && t.sprint_id !== taskSprintFilter) return false;
                if (taskAssigneeFilter !== "all" && t.assigned_to !== taskAssigneeFilter) return false;
                if (taskStatusFilter !== "all" && t.status_id !== taskStatusFilter) return false;
                if (taskDueFilter !== "all") {
                  if (taskDueFilter === "none") { if (t.due_date) return false; }
                  else {
                    const now = new Date(); const due = t.due_date ? new Date(t.due_date) : null;
                    if (!due) return false;
                    if (taskDueFilter === "overdue" && due >= now) return false;
                    if (taskDueFilter === "today") { const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (due < today || due >= new Date(today.getTime() + 86400000)) return false; }
                    if (taskDueFilter === "week") { const weekEnd = new Date(now.getTime() + 7 * 86400000); if (due > weekEnd) return false; }
                  }
                }
                return true;
              });
              return filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-[0.06em] text-[#9CA3AF] font-medium">
                        <th className="px-6 py-3 text-left">TASK</th>
                        <th className="px-6 py-3 text-left">ASSIGNED TO</th>
                        <th className="px-6 py-3 text-left">PRIORITY</th>
                        <th className="px-6 py-3 text-left">STATUS</th>
                        <th className="px-6 py-3 text-left">PROGRESS</th>
                        <th className="px-6 py-3 text-left">EST. HOURS</th>
                        <th className="px-6 py-3 text-left">DUE DATE</th>
                        <th className="px-6 py-3 text-left">FLAGGED</th>
                        <th className="px-6 py-3 text-center">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                    {filteredTasks.map((t: any) => {
                      const assigneeName = (t as any).users?.full_name || "";
                      const initials = assigneeName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
                      const assigneeColors: Record<string, string> = { L: "bg-orange-100 text-orange-700", G: "bg-emerald-100 text-emerald-700", A: "bg-blue-100 text-blue-700", M: "bg-purple-100 text-purple-700", S: "bg-pink-100 text-pink-700" };
                      const firstLetter = initials[0] || "A";
                      const avatarColor = assigneeColors[firstLetter] || "bg-gray-100 text-gray-700";

                      const priorityIconColors: Record<string, string> = { low: "text-[#3B82F6]", medium: "text-[#F97316]", high: "text-[#EF4444]" };
                      const pColor = priorityIconColors[t.priority] || "text-[#9CA3AF]";

                      const statusColors: Record<string, string> = { "not_started": "text-[#D97706]", "in_progress": "text-[#2563EB]", "blocked": "text-[#DC2626]", "done": "text-[#059669]", "unlinked": "text-[#D97706]", "returned": "text-[#6B7280]", "complete": "text-[#059669]", "linked": "text-[#2563EB]", "active": "text-[#2563EB]" };
                      const sColor = statusColors[t.status] || "text-[#374151]";

                      return (
                        <tr key={t.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[14px] text-[#111827] leading-tight">
                              {t.title}
                              {criticalTaskIds.has(t.id) && <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">Critical Path</Badge>}
                              {t.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === t.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">{s.name}</Badge> : null; })()}
                              {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5 shrink-0" />}
                            </div>
                            <div className="text-[12px] text-[#9CA3AF] mt-0.5 truncate max-w-[280px]">{truncateWords(t.description, 5) || ""}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold ${avatarColor}`}>
                                {initials}
                              </div>
                              <span className="text-[13px] text-[#374151]">{assigneeName || "Unassigned"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`flex items-end gap-[2px] ${pColor}`}>
                                <div className="w-[3px] h-[6px] rounded-sm bg-current" />
                                <div className="w-[3px] h-[10px] rounded-sm bg-current" />
                                <div className="w-[3px] h-[14px] rounded-sm bg-current" />
                              </div>
                              <span className={`text-[13px] capitalize ${pColor}`}>{t.priority}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-3.5 h-3.5 rounded-full border-[2px] border-current ${sColor}`} />
                              <span className={`text-[13px] capitalize ${sColor}`}>{t.status.replace(/_/g, " ")}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const totalEst = t.estimated_hours || 1;
                              const logged = hoursByTask[t.id] || 0;
                              const pct = Math.min(100, Math.round((logged / totalEst) * 100));
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#22C55E] rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[12px] text-[#6B7280] font-medium">{pct}%</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] text-[#374151]">{t.estimated_hours ? `${Number(t.estimated_hours).toFixed(1)}h` : "—"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] text-[#374151]">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] text-[#9CA3AF]">—</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setViewTaskData(t)} className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center hover:bg-[#FFEDD5] transition-colors" title="View">
                                <Eye className="h-[15px] w-[15px] text-[#EA580C]" />
                              </button>
                              <button onClick={() => openEditTask(t)} className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center hover:bg-[#FFEDD5] transition-colors" title="Edit">
                                <Pencil className="h-[15px] w-[15px] text-[#EA580C]" />
                              </button>
                              {profile?.role === "admin" && (
                                <button onClick={() => setDeleteTaskConfirmId(t.id)} className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center hover:bg-[#FFEDD5] transition-colors" title="Delete">
                                  <Trash2 className="h-[15px] w-[15px] text-[#EA580C]" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
            );
          })()}
                </>
              )}
            </TabsContent>

            {/* ── Kanban Sub-tab ── */}
            <TabsContent value="kanban" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Kanban</h2>
                {isAdmin && (
                  <Button size="sm" onClick={() => setAddTaskOpen(true)} className="rounded-button bg-[#EC6824] hover:bg-[#c4541a] text-white">
                    <Plus className="h-4 w-4 mr-1" />Add Task
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <Input placeholder="Search tasks..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="pl-9 h-9 text-sm border-[#E5E7EB]" />
                </div>
                <Select value={taskPhaseFilter} onValueChange={setTaskPhaseFilter}>
                  <SelectTrigger className="w-[130px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Phase: All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Phase: All</SelectItem>
                    {(phases || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={kanbanSprintFilter} onValueChange={setKanbanSprintFilter}>
                  <SelectTrigger className="w-[130px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Sprint: All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sprint: All</SelectItem>
                    {(sprints || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                  <SelectTrigger className="w-[150px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Assignee: All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Assignee: All</SelectItem>
                    {(resourceMembers || []).map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name || "Unknown"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                  <SelectTrigger className="w-[130px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Status: All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status: All</SelectItem>
                    {(workflowStatuses || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taskDueFilter} onValueChange={setTaskDueFilter}>
                  <SelectTrigger className="w-[120px] h-9 text-xs border-[#E5E7EB]"><SelectValue placeholder="Due: Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Due: Any</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="none">No Due Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "500px" }}>
                {(workflowStatuses || []).map((status: any) => {
                  const statusNameLower = status.name?.toLowerCase();
                  const statusIdMatch = taskStatusFilter === "all" || taskStatusFilter === status.id;
                  const tasksInColumn = (tasks || []).filter((t: any) => {
                    const matchStatus = t.status === status.name || t.status_id === status.id;
                    if (!matchStatus) return false;
                    if (taskSearch) {
                      const q = taskSearch.toLowerCase();
                      if (!t.title?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
                    }
                    if (taskPhaseFilter !== "all" && t.phase_id !== taskPhaseFilter) return false;
                    if (kanbanSprintFilter !== "all" && t.sprint_id !== kanbanSprintFilter) return false;
                    if (taskAssigneeFilter !== "all" && t.assigned_to !== taskAssigneeFilter) return false;
                    if (taskDueFilter !== "all") {
                      if (taskDueFilter === "none") { if (t.due_date) return false; }
                      else {
                        const now = new Date(); const due = t.due_date ? new Date(t.due_date) : null;
                        if (!due) return false;
                        if (taskDueFilter === "overdue" && due >= now) return false;
                        if (taskDueFilter === "today") { const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (due < today || due >= new Date(today.getTime() + 86400000)) return false; }
                        if (taskDueFilter === "week") { const weekEnd = new Date(now.getTime() + 7 * 86400000); if (due > weekEnd) return false; }
                      }
                    }
                    if (!statusIdMatch) return false;
                    return true;
                  });

                  const dotColor = status.category === "done" ? "bg-green-500" : status.category === "in_progress" ? "bg-yellow-500" : status.category === "blocked" ? "bg-red-500" : "bg-gray-400";

                  return (
                    <div key={status.id} className="flex-shrink-0 w-72 bg-[#F8F9FA] rounded-xl flex flex-col">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                          <span className="font-semibold text-sm text-[#111827]">{status.name.replace(/_/g, " ")}</span>
                        </div>
                        <span className="text-xs text-[#9CA3AF] bg-white rounded-full px-2 py-0.5 border border-[#E5E7EB]">{tasksInColumn.length}</span>
                      </div>
                      <div className="px-2 pb-2 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
                        {tasksInColumn.map((t: any) => (
                          <div
                            key={t.id}
                            className="bg-white rounded-lg p-3 border border-[#E5E7EB] cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setViewTaskData(t)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-[#111827] leading-tight line-clamp-2">{t.title}</span>
                              <Badge className={`shrink-0 text-[10px] ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</Badge>
                            </div>
                            {t.sprint_id && (() => {
                              const s = sprints.find((sp: any) => sp.id === t.sprint_id);
                              return s ? <Badge className="bg-blue-100 text-blue-700 text-[10px] mt-1.5">{s.name}</Badge> : null;
                            })()}
                            {t.description && (
                              <p className="text-xs text-[#9CA3AF] mt-1.5 line-clamp-2">{t.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {(t as any).users?.full_name && (
                                <>
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={getAvatarUrl((t as any).users?.full_name)} />
                                    <AvatarFallback className="text-[8px] bg-[#EC6824] text-white">{(t as any).users?.full_name?.charAt(0) || "?"}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-[#374151]">{(t as any).users?.full_name}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F3F4F6]">
                              <span className="text-xs text-[#9CA3AF]">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</span>
                              <span className="text-xs text-[#9CA3AF]">{t.due_date ? `Due ${format(new Date(t.due_date + "T00:00:00"), "MMM d")}` : "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Action Items Sub-tab ── */}
            <TabsContent value="action-items" className="space-y-4">
              {!isAdmin && !isClient && (
                <>
            <h2 className="text-lg font-semibold">My Action Items</h2>
            {(() => {
              const myActionItems = actionItems.filter((a: any) => a.assigned_to === profile?.id);
              if (myActionItems.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No action items assigned to you yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Action items linked to your tasks will appear here.</p>
                  </div>
                );
              }
              return (
                <div>
                  <TableHeader gridCols="1fr 140px 140px 100px 80px 120px 80px">
                    <span>TITLE</span>
                    <span>RELATED BLOCKER</span>
                    <span>RELATED TASK</span>
                    <span>STATUS</span>
                    <span>PRIORITY</span>
                    <span>REQUESTED BY</span>
                    <span className="text-right">ACTIONS</span>
                  </TableHeader>
                  {myActionItems.map((a: any) => {
                    const isExpanded = expandedActionItemId === a.id;
                    const linkedTask = (tasks || []).find((t: any) => t.id === a.blockers?.task_id);
                    return (
                      <div key={a.id}>
                        <DataRow gridCols="1fr 140px 140px 100px 80px 120px 80px">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedActionItemId(isExpanded ? null : a.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <div>
                              <RowPrimary>{a.title}</RowPrimary>
                              {a.description && <RowSecondary>{truncateWords(a.description, 6)}</RowSecondary>}
                            </div>
                          </div>
                          <RowDataItem label="RELATED BLOCKER">{a.blockers?.description || a.blockers?.title || "—"}</RowDataItem>
                          <RowDataItem label="RELATED TASK">{linkedTask?.title || "—"}</RowDataItem>
                          <RowBadgeItem label="STATUS">
                            <Badge className={
                              a.status === "completed" ? "bg-green-100 text-green-800" :
                              a.status === "waived" ? "bg-gray-100 text-gray-800" :
                              "bg-yellow-100 text-yellow-800"
                            }>{a.status}</Badge>
                          </RowBadgeItem>
                          <RowBadgeItem label="PRIORITY">
                            <Badge className={PRIORITY_COLORS[a.priority] || "bg-gray-100 text-gray-800"}>{a.priority || "medium"}</Badge>
                          </RowBadgeItem>
                          <RowDataItem label="REQUESTED BY">{a.requested_by_user?.full_name || "—"}</RowDataItem>
                          <RowActions className="justify-self-end">
                            {a.status === "pending" && (
                              <button onClick={() => completeActionItem(a.id)} className={editButtonClass} title="Mark Resolved">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </button>
                            )}
                          </RowActions>
                        </DataRow>
                        {isExpanded && (
                          <div className="bg-[#f9fafb] border-t border-[#e5e7eb] px-4 py-4 space-y-4 ml-6">
                            {a.description && (
                              <div className="text-sm text-muted-foreground">{a.description}</div>
                            )}
                            <div className="flex flex-wrap gap-3 text-sm">
                              {a.due_date && <span className="text-muted-foreground">Due: <span className="text-foreground font-medium">{format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy")}</span></span>}
                              {a.completed_at && <span className="text-muted-foreground">Completed: <span className="text-foreground font-medium">{format(new Date(a.completed_at), "MMM d, yyyy 'at' h:mm a")}</span></span>}
                            </div>
                            {a.status === "completed" && a.resolver && (
                              <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800">
                                Resolved by {a.resolver.full_name} on {a.completed_at ? format(new Date(a.completed_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                              </div>
                            )}
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {actionItemMessages.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No messages yet.</p>
                              ) : (
                                actionItemMessages.map((m: any) => (
                                  <div key={m.id} className="flex gap-2 bg-white rounded-md p-2.5 border border-[#e5e7eb]">
                                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                      <AvatarImage src={getAvatarUrl(m.sender?.full_name)} />
                                      <AvatarFallback className="text-[10px]">{m.sender?.full_name?.charAt(0) || "?"}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold">{m.sender?.full_name || "Unknown"}</span>
                                        <Badge className="text-[9px] bg-blue-100 text-blue-800">{m.sender?.role || "employee"}</Badge>
                                        <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), "MMM d, h:mm a")}</span>
                                      </div>
                                      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{renderMessageContent(m.content)}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            {a.status === "pending" && (
                              <div className="flex gap-2">
                                <Textarea value={newActionItemMessage} onChange={(e) => setNewActionItemMessage(e.target.value)} placeholder="Type a reply..." className="min-h-[60px] text-sm" />
                                <Button size="sm" className="rounded-button shrink-0" disabled={!newActionItemMessage.trim()} onClick={() => sendActionItemMessage(a.id)}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
                </>
              )}
              {isAdmin && (
                <>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-[22px] font-bold text-[#111827]">Action Items</h2>
                <p className="text-[13px] text-[#9CA3AF] mt-0.5">Commitments and follow-ups from meetings, reviews, and client requests</p>
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-[#EA580C] text-white text-[13px] font-medium rounded-lg hover:bg-[#C2410C] transition-colors">
                <Plus className="h-4 w-4" />
                Add Action Item
              </button>
            </div>
            {actionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No action items yet.</p>
            ) : (
              <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-[0.06em] text-[#9CA3AF] font-medium">
                      <th className="px-6 py-3 text-left">DESCRIPTION</th>
                      <th className="px-6 py-3 text-left">OWNER</th>
                      <th className="px-6 py-3 text-left">DUE DATE</th>
                      <th className="px-6 py-3 text-left">SOURCE</th>
                      <th className="px-6 py-3 text-left">STATUS</th>
                      <th className="px-6 py-3 text-left">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionItems.map((a: any) => {
                      const ownerName = a.assigned_to_user?.full_name || "";
                      const ownerInitials = ownerName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "";
                      const ownerColors: Record<string, string> = { L: "bg-orange-100 text-orange-700", G: "bg-emerald-100 text-emerald-700", A: "bg-blue-100 text-blue-700" };
                      const ownerColor = ownerColors[ownerInitials[0] || "L"] || "bg-gray-100 text-gray-700";

                      const statusBadgeStyles: Record<string, string> = {
                        "completed": "bg-green-100 text-green-700",
                        "unassigned": "bg-orange-100 text-orange-700",
                        "open": "bg-blue-100 text-blue-700",
                        "pending": "bg-orange-100 text-orange-700",
                      };
                      const badgeStyle = statusBadgeStyles[a.status] || "bg-gray-100 text-gray-700";

                      return (
                        <tr key={a.id} className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-[14px] text-[#111827] truncate max-w-[320px] block">{a.title}</span>
                          </td>
                          <td className="px-6 py-4">
                            {ownerInitials ? (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold ${ownerColor}`}>
                                {ownerInitials}
                              </div>
                            ) : (
                              <span className="text-[13px] text-[#9CA3AF]">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] text-[#374151]">{a.due_date ? format(new Date(a.due_date + "T00:00:00"), "MMM d") : "—"}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] text-[#9CA3AF]">—</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium capitalize ${badgeStyle}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {a.status !== "completed" ? (
                              <button onClick={() => convertActionItemToTask(a.id)} className="text-[13px] font-medium text-[#EA580C] hover:text-[#C2410C] transition-colors">
                                Convert to Task
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Client-only tabs (rendered via sidebar sub-nav) */}
        {/* Client-only tabs (rendered via sidebar sub-nav) */}
        {isClient && (
          <>
            <TabsContent value="phase-progress">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Phase Progress</h3>
              </div>
              {(() => {
                const clientTasks = (tasks || []).filter((t: any) => t.client_visible === true);
                const doneStatusIds = new Set(
                  (workflowStatuses || []).filter((s: any) => s.category === "done").map((s: any) => s.id)
                );

                const clientPhaseTaskCount: Record<string, number> = {};
                clientTasks.forEach((t: any) => {
                  if (t.phase_id) clientPhaseTaskCount[t.phase_id] = (clientPhaseTaskCount[t.phase_id] || 0) + 1;
                });

                const clientPhaseProgress: Record<string, number> = {};
                (phases || []).forEach((p: any) => {
                  const pts = clientTasks.filter((t: any) => t.phase_id === p.id);
                  if (pts.length === 0) { clientPhaseProgress[p.id] = 0; return; }
                  const completed = pts.filter((t: any) => doneStatusIds.has(t.status_id)).length;
                  clientPhaseProgress[p.id] = Math.round((completed / pts.length) * 100);
                });

                const visiblePhases = (phases || []).filter((p: any) => (clientPhaseTaskCount[p.id] || 0) > 0);

                if (visiblePhases.length === 0) {
                  return <Card className="p-6"><p className="text-muted-foreground">No phase progress to display.</p></Card>;
                }

                return (
                  <div>
                    <TableHeader gridCols="1fr 96px 112px 192px">
                      <span>PHASE</span>
                      <span>TASKS</span>
                      <span>DUE DATE</span>
                      <span>PROGRESS</span>
                    </TableHeader>
                    {visiblePhases.map((p: any) => (
                      <DataRow key={p.id} gridCols="1fr 96px 112px 192px">
                        <div>
                          <RowPrimary>{p.title}</RowPrimary>
                          <RowSecondary>
                            {clientPhaseTaskCount[p.id] || 0} tasks · {(sprints || []).filter((s: any) => s.phase_id === p.id).length} sprints
                          </RowSecondary>
                        </div>
                        <RowDataItem label="TASKS">{clientPhaseTaskCount[p.id] || 0}</RowDataItem>
                        <RowDataItem label="DUE DATE">{p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}</RowDataItem>
                        <RowDataItem label="PROGRESS">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-md h-2">
                              <div className="bg-primary h-2 rounded-md transition-all" style={{ width: `${clientPhaseProgress[p.id]}%` }} />
                            </div>
                            <span className="text-[11px] text-[#6b7280]">{clientPhaseProgress[p.id]}%</span>
                          </div>
                        </RowDataItem>
                      </DataRow>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
            <TabsContent value="tasks" className="space-y-4">
              {(() => {
                const scopeTasks = burndownScope === "project"
                  ? (tasks || []).filter((t: any) => t.client_visible === true)
                  : (tasks || []).filter((t: any) => t.client_visible === true && t.phase_id === burndownScope);

                const doneStatusIds = new Set(
                  (workflowStatuses || []).filter((s: any) => s.category === "done").map((s: any) => s.id)
                );
                const completed = scopeTasks.filter((t: any) => doneStatusIds.has(t.status_id));
                const total = scopeTasks.length;
                const doneCount = completed.length;
                const remainingTasks = total - doneCount;
                const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

                const scopePhase = burndownScope !== "project" ? phases.find((p: any) => p.id === burndownScope) : null;
                const endDate = scopePhase?.due_date || project?.end_date;
                const startDate = project?.start_date;

                if (total === 0) {
                  return (
                    <Card className="p-6 text-center">
                      <p className="text-muted-foreground">No client-visible tasks are available for this project.</p>
                    </Card>
                  );
                }

                if (!endDate || !startDate) {
                  return (
                    <Card className="p-6 text-center">
                      <p className="text-muted-foreground">Project needs start and end dates for burndown.</p>
                    </Card>
                  );
                }

                const daysTotal = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
                const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86400000));
                const idealPerDay = total / daysTotal;
                const idealRemaining = Math.max(0, total - idealPerDay * Math.min(daysElapsed, daysTotal));

                const burndownData = [
                  { name: "Start", ideal: total, actual: total },
                  { name: "Now", ideal: idealRemaining, actual: remainingTasks },
                  { name: "Due", ideal: 0, actual: null },
                ];

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="p-4 text-center">
                        <span className="text-xs text-muted-foreground block">Total Tasks</span>
                        <span className="text-2xl font-bold">{total}</span>
                      </Card>
                      <Card className="p-4 text-center">
                        <span className="text-xs text-muted-foreground block">Completed</span>
                        <span className="text-2xl font-bold text-green-600">{doneCount}</span>
                      </Card>
                      <Card className="p-4 text-center">
                        <span className="text-xs text-muted-foreground block">Remaining</span>
                        <span className="text-2xl font-bold">{remainingTasks}</span>
                      </Card>
                      <Card className="p-4 text-center">
                        <span className="text-xs text-muted-foreground block">Progress</span>
                        <span className="text-2xl font-bold">{pct}%</span>
                      </Card>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Task Burndown</h3>
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

                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={burndownData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="ideal" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Ideal" />
                        <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls name="Actual" />
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Tasks</h3>
                      {(() => {
                        const clientTasks = (tasks || []).filter((t: any) => t.client_visible === true);
                        if (clientTasks.length === 0) {
                          return <p className="text-sm text-muted-foreground">No client-visible tasks are available for this project.</p>;
                        }
                        return (
                          <table className="w-full">
                            <thead>
                              <tr className="hidden md:table-row border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.05em] text-[#9ca3af] font-medium">
                                <th className="px-4 py-2 text-left">TASK</th>
                                <th className="px-4 py-2 text-left">ASSIGNED TO</th>
                                <th className="px-4 py-2 text-left">PRIORITY</th>
                                <th className="px-4 py-2 text-left">STATUS</th>
                                <th className="px-4 py-2 text-left">DUE DATE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientTasks.map((t: any) => (
                                <tr key={t.id} className="bg-white hover:bg-[#f1f5f9] border-b border-[#f3f4f6] transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-[15px] text-[#111827] truncate">{t.title}</div>
                                    <div className="text-[12px] text-[#6b7280] mt-0.5 truncate">{truncateWords(t.description, 4) || "—"}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[13px] text-[#374151]">{(t as any).users?.full_name || "—"}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge className={TASK_STATUS_COLORS[t.status] || ""}>{t.status.replace(/_/g, " ")}</Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[13px] text-[#374151]">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>

                  </>
                );
              })()}
            </TabsContent>
            <TabsContent value="blockers" className="space-y-4">
              <h2 className="text-lg font-semibold">Blockers</h2>
              {projectBlockers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blockers reported.</p>
              ) : (
                <div className="space-y-2">
                  {projectBlockers.filter((b: any) => b.client_visible !== false).map((b: any) => (
                    <div key={b.id} className="flex items-start justify-between gap-2 bg-muted/30 rounded-md p-3">
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
                        {b.linked_action_items && b.linked_action_items.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-[10px] text-muted-foreground">Linked Action Items:</span>
                            {b.linked_action_items.map((item: any) => (
                              <Badge key={item.id} className={`text-[10px] ${item.status === "completed" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                                {item.title} ({item.status})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="status-updates" className="space-y-4">
              <h2 className="text-lg font-semibold">Status Updates</h2>
              {(() => {
                const visibleUpdates = (statusUpdates || []).filter((u: any) => u.visible_to_client === true);
                if (visibleUpdates.length === 0) {
                  return <p className="text-sm text-muted-foreground">No status updates yet.</p>;
                }
                return (
                  <div className="space-y-3">
                    {visibleUpdates.map((u: any) => (
                      <div key={u.id} className="flex gap-2 bg-muted/30 rounded-md p-3">
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                          <AvatarFallback className="text-[10px]">{u.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), "MMM d, h:mm a")}</span>
                          </div>
                          <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{u.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
            <TabsContent value="action-items" className="space-y-4">
              <h2 className="text-lg font-semibold">Action Items</h2>
              {actionItems.filter((a: any) => {
                if (a.visible_to_client === false) return false;
                if (a.assigned_to) return a.assigned_to === profile?.id;
                return true;
              }).length === 0 ? (
                <p className="text-sm text-muted-foreground">No action items yet.</p>
              ) : (
                <div className="space-y-0">
                  {actionItems.filter((a: any) => {
                    if (a.visible_to_client === false) return false;
                    if (a.assigned_to) return a.assigned_to === profile?.id;
                    return true;
                  }).map((a: any) => {
                    const isExpanded = expandedActionItemId === a.id;
                    return (
                      <div key={a.id} className="border-b border-[#f3f4f6]">
                        <button
                          type="button"
                          onClick={() => setExpandedActionItemId(isExpanded ? null : a.id)}
                          className="w-full flex items-center gap-2 bg-white hover:bg-[#f1f5f9] px-4 py-3 text-left transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[15px] text-[#111827] truncate">{a.title}</div>
                            {a.description && <div className="text-[12px] text-[#6b7280] mt-0.5 truncate">{a.description}</div>}
                          </div>
                          <Badge className={
                            a.status === "completed" ? "bg-green-100 text-green-800" :
                            a.status === "waived" ? "bg-gray-100 text-gray-800" :
                            "bg-yellow-100 text-yellow-800"
                          }>{a.status}</Badge>
                          {a.due_date && <span className="text-[12px] text-[#6b7280] hidden sm:inline ml-2">{format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy")}</span>}
                        </button>
                        {isExpanded && (
                          <div className="bg-[#f9fafb] border-t border-[#e5e7eb] px-4 py-4 space-y-4">
                            {a.status === "completed" && a.resolver && (
                              <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800">
                                Resolved by {a.resolver.full_name} on {a.completed_at ? format(new Date(a.completed_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                              </div>
                            )}
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {actionItemMessages.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No messages yet.</p>
                              ) : (
                                actionItemMessages.map((m: any) => (
                                  <div key={m.id} className="flex gap-2 bg-white rounded-md p-2.5 border border-[#e5e7eb]">
                                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                      <AvatarImage src={getAvatarUrl(m.sender?.full_name)} />
                                      <AvatarFallback className="text-[10px]">{m.sender?.full_name?.charAt(0) || "?"}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold">{m.sender?.full_name || "Unknown"}</span>
                                        <Badge className="text-[9px] bg-blue-100 text-blue-800">{m.sender?.role || "client member"}</Badge>
                                        <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), "MMM d, h:mm a")}</span>
                                      </div>
                                      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{renderMessageContent(m.content)}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            {a.status === "pending" && (
                              <div className="flex gap-2">
                                <Textarea
                                  value={expandedActionItemId === a.id ? newActionItemMessage : ""}
                                  onChange={(e) => setNewActionItemMessage(e.target.value)}
                                  placeholder="Type a message or paste a link..."
                                  rows={2}
                                  className="text-sm resize-none"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => sendActionItemMessage(a.id)}
                                  disabled={!newActionItemMessage.trim()}
                                  className="shrink-0 self-end"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </>
        )}

        {/* ═══ PLANNING TAB — Phases · Sprints ═══ */}
        <TabsContent value="planning">
          <Tabs value={planningSubTab} onValueChange={setPlanningSubTab} className="mt-0">
            <TabsList className="mb-6 border-b border-[#E5E7EB] bg-transparent h-auto p-0 gap-0">
              <TabsTrigger value="phases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#EA580C] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[13px] font-medium text-[#6B7280] data-[state=active]:text-[#111827] py-2.5 px-4">
                <span className="flex items-center gap-1.5"><CalendarIcon className="h-4 w-4" /> Phases</span>
              </TabsTrigger>
              <TabsTrigger value="sprints" onClick={() => setSelectedPhaseForSprints(null)} className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#EA580C] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[13px] font-medium text-[#6B7280] data-[state=active]:text-[#111827] py-2.5 px-4">
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Sprints ({sprints.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Phases Sub-tab ── */}
            <TabsContent value="phases">
              {isAdmin && (
                <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-bold text-[#111827]">Phases</h2>
              <button onClick={() => setAddPhaseOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#EA580C] text-white text-[13px] font-medium rounded-lg hover:bg-[#C2410C] transition-colors">
                <Plus className="h-4 w-4" />
                Add Phase
              </button>
            </div>
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phases yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {phases.map((p: any) => {
                  const sprintCount = (sprints || []).filter((s: any) => s.phase_id === p.id).length;
                  const pct = phaseProgress[p.id] || 0;
                  return (
                    <div key={p.id} onClick={() => { setSelectedPhaseForSprints(p.id); setPlanningSubTab("sprints"); }} className="border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-sm transition-shadow cursor-pointer">
                      <h3 className="font-bold text-[16px] text-[#111827]">{p.title}</h3>
                      <p className="text-[13px] text-[#9CA3AF] mt-1">{sprintCount} sprint{sprintCount !== 1 ? "s" : ""}</p>
                      <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-[#EA580C] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[13px] text-[#374151] mt-2">{pct}% complete</p>
                    </div>
                  );
                })}
              </div>
            )}
                </>
              )}
            </TabsContent>

            {/* ── Sprints Sub-tab ── */}
            <TabsContent value="sprints" className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[22px] font-bold text-[#111827]">Sprints</h2>
              {selectedPhaseForSprints && (
                <button onClick={() => setSelectedPhaseForSprints(null)} className="text-[12px] text-[#EA580C] hover:text-[#C2410C] font-medium flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Clear filter
                </button>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => setAddSprintOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#EA580C] text-white text-[13px] font-medium rounded-lg hover:bg-[#C2410C] transition-colors">
                <Plus className="h-4 w-4" /> Add Sprint
              </button>
            )}
          </div>
          {sprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sprints yet.</p>
          ) : (
            <div className="space-y-8">
              {(phases || [])
                .filter((p: any) => {
                  if (selectedPhaseForSprints) return p.id === selectedPhaseForSprints;
                  return sprints.some((s: any) => s.phase_id === p.id);
                })
                .map((phase: any) => {
                  const phaseSprints = sprints.filter((s: any) => s.phase_id === phase.id);
                  return (
                    <div key={phase.id}>
                      <div className="flex items-center gap-2 mb-4">
                        <h4 className="font-bold text-[15px] text-[#111827]">{phase.title}</h4>
                        <span className="text-[12px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">{phaseSprints.length} sprint{phaseSprints.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {phaseSprints.map((s: any) => {
                          const sprintTasksList = (tasks || []).filter((t: any) => t.sprint_id === s.id);
                          const doneStatusIds = new Set((workflowStatuses || []).filter((st: any) => st.category === "done").map((st: any) => st.id));
                          const sprintDone = sprintTasksList.filter((t: any) => doneStatusIds.has(t.status_id)).length;
                          const pct = sprintTasksList.length > 0 ? Math.round((sprintDone / sprintTasksList.length) * 100) : 0;
                          const statusLabel = s.status === "active" ? "active" : s.status === "completed" ? "completed" : "planned";
                          return (
                            <div key={s.id} className="border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-sm transition-shadow w-[420px]">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-bold text-[15px] text-[#111827]">{s.name}</h5>
                                <span className={`text-[12px] font-medium px-3 py-1 rounded-full ${s.status === "active" ? "bg-green-100 text-green-700" : s.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-3">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}
                              </div>
                              <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden mb-3">
                                <div className="h-full bg-[#EA580C] rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] text-[#374151]">{sprintTasksList.length} task{sprintTasksList.length !== 1 ? "s" : ""}</span>
                                {isAdmin && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEditSprint(s)} className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center hover:bg-[#FFEDD5] transition-colors" title="Edit Sprint">
                                      <Pencil className="h-[15px] w-[15px] text-[#EA580C]" />
                                    </button>
                                    <button onClick={() => deleteSprint(s.id)} className="w-8 h-8 rounded-full bg-[#FEF2F2] flex items-center justify-center hover:bg-[#FEE2E2] transition-colors" title="Delete Sprint">
                                      <Trash2 className="h-[15px] w-[15px] text-[#DC2626]" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              {sprints.some((s: any) => !s.phase_id) && (
                <div>
                  <h4 className="font-bold text-[15px] text-[#111827] mb-4">Unassigned</h4>
                  <div className="flex flex-wrap gap-3">
                    {sprints.filter((s: any) => !s.phase_id).map((s: any) => {
                      const sprintTasksList = (tasks || []).filter((t: any) => t.sprint_id === s.id);
                      const doneStatusIds = new Set((workflowStatuses || []).filter((st: any) => st.category === "done").map((st: any) => st.id));
                      const sprintDone = sprintTasksList.filter((t: any) => doneStatusIds.has(t.status_id)).length;
                      const pct = sprintTasksList.length > 0 ? Math.round((sprintDone / sprintTasksList.length) * 100) : 0;
                      return (
                        <div key={s.id} className="border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-sm transition-shadow w-[420px]">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-bold text-[15px] text-[#111827]">{s.name}</h5>
                            <span className={`text-[12px] font-medium px-3 py-1 rounded-full ${s.status === "active" ? "bg-green-100 text-green-700" : s.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                              {s.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-3">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}
                          </div>
                          <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-[#EA580C] rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] text-[#374151]">{sprintTasksList.length} task{sprintTasksList.length !== 1 ? "s" : ""}</span>
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <button onClick={() => openEditSprint(s)} className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center hover:bg-[#FFEDD5] transition-colors" title="Edit Sprint">
                                  <Pencil className="h-[15px] w-[15px] text-[#EA580C]" />
                                </button>
                                <button onClick={() => deleteSprint(s.id)} className="w-8 h-8 rounded-full bg-[#FEF2F2] flex items-center justify-center hover:bg-[#FEE2E2] transition-colors" title="Delete Sprint">
                                  <Trash2 className="h-[15px] w-[15px] text-[#DC2626]" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══ PEOPLE TAB — Resources · Clients ═══ */}
        <TabsContent value="people">
          <Tabs value={peopleSubTab} onValueChange={setPeopleSubTab} className="mt-0">
            <TabsList className="mb-4">
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="clients">Clients</TabsTrigger>
            </TabsList>

            {/* ── Resources Sub-tab ── */}
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
                        <button onClick={() => { setConfirmMemberDelId(m.id); setConfirmMemberDelUserId((m.users as any)?.id); }} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Remove">
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

            {/* ── Clients Sub-tab ── */}
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
                        <Button variant="ghost" size="icon" onClick={() => { setConfirmMemberDelId(m.id); setConfirmMemberDelUserId((m.users as any)?.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {clientMembers.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 2 : 1} className="text-center text-muted-foreground py-8">No client members assigned</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══ ACTIVITY TAB — Logs ═══ */}
        {isAdmin && (
          <TabsContent value="activity">
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

        {/* ═══ INSIGHTS TAB — Stats & Charts ═══ */}
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
            const remaining = Math.max(0, totalEst - logged);

            if (estimated.length === 0 || !endDate || !startDate) {
              return (
                <BurndownChart
                  totalEst={0}
                  loggedHrs={0}
                  remaining={0}
                  unestimatedCount={unestimated.length}
                  burndownData={[]}
                  totalEstimatedHours={0}
                  burndownScope={burndownScope}
                  onScopeChange={setBurndownScope}
                  phases={phases}
                  emptyMessage="Burndown requires estimated tasks and project dates."
                />
              );
            }

            const bd = [
              { name: "Start", actual: totalEst },
              { name: "Now", actual: remaining, isNow: true },
              { name: "Due", actual: null },
            ];

            return (
              <BurndownChart
                totalEst={totalEst}
                loggedHrs={logged}
                remaining={remaining}
                unestimatedCount={unestimated.length}
                burndownData={bd}
                totalEstimatedHours={totalEst}
                burndownScope={burndownScope}
                onScopeChange={setBurndownScope}
                phases={phases}
                emptyMessage="Burndown requires estimated tasks and project dates."
              />
            );
          })()}

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

        {/* ═══ AUTOMATION TAB — Rules ═══ */}
        {isAdmin && (
          <TabsContent value="automation" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Automation Rules</h3>
              <Button onClick={openAddRule}><Plus className="h-4 w-4" /> Add Rule</Button>
            </div>
            {automationRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automation rules yet. Create rules to automate project workflows.</p>
            ) : (
              <div className="space-y-3">
                {automationRules.map((rule: any) => (
                  <Card key={rule.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold">{rule.name}</h4>
                          <Badge variant="outline">{rule.trigger_type.replace(/_/g, " ")}</Badge>
                          <Badge variant={rule.status === "enabled" ? "default" : "secondary"}>{rule.status}</Badge>
                        </div>
                        {rule.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{rule.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Priority: {rule.priority} &middot; {rule.allow_triggering_other_rules ? "Chainable" : "No chaining"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={rule.status === "enabled"} onCheckedChange={(c) => toggleRuleStatus(rule.id, c)} />
                        <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteRuleConfirmId(rule.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Automation Rule Dialog */}
      <Dialog open={automationRulesOpen} onOpenChange={(o) => { if (!o) { resetRuleForm(); } setAutomationRulesOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRuleId ? "Edit Automation Rule" : "Add Automation Rule"}</DialogTitle></DialogHeader>
          <form onSubmit={saveAutomationRule} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Name *</Label>
              <Input id="ruleName" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Block critical task on blocker" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleDescription">Description *</Label>
              <Textarea id="ruleDescription" value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} placeholder="Describe what this rule does" rows={2} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={ruleStatus} onValueChange={setRuleStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select value={ruleTriggerType} onValueChange={setRuleTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status_change">Status Change</SelectItem>
                    <SelectItem value="blocker_raised">Blocker Raised</SelectItem>
                    <SelectItem value="blocker_resolved">Blocker Resolved</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rulePriority">Priority (higher = runs first)</Label>
                <Input id="rulePriority" type="number" value={rulePriority} onChange={(e) => setRulePriority(Number(e.target.value))} />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch id="ruleAllowTriggering" checked={ruleAllowTriggering} onCheckedChange={setRuleAllowTriggering} />
                  <Label htmlFor="ruleAllowTriggering" className="text-sm">Allow triggering other rules</Label>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Conditions (all must match)</Label>
                <Button variant="outline" size="sm" onClick={addCondition} type="button">
                  <Plus className="h-4 w-4" /> Add Condition
                </Button>
              </div>
              {ruleConditions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No conditions — rule matches all events.</p>
              ) : (
                ruleConditions.map((cond, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Select value={cond.field} onValueChange={(v) => setRuleConditions(ruleConditions.map((c, i) => i === idx ? { field: v, operator: "eq", value: "" } : c))}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status_id">Task Status</SelectItem>
                        <SelectItem value="priority">Task Priority</SelectItem>
                        <SelectItem value="due_date">Due Date</SelectItem>
                        <SelectItem value="assigned_to">Assigned To</SelectItem>
                        <SelectItem value="description">Task Description</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, "operator", v)}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">equals</SelectItem>
                        <SelectItem value="neq">not equals</SelectItem>
                        <SelectItem value="gt">greater than</SelectItem>
                        <SelectItem value="lt">less than</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                      </SelectContent>
                    </Select>
                    {cond.field === "status_id" ? (
                      <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {(workflowStatuses || []).map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : cond.field === "priority" ? (
                      <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : cond.field === "due_date" ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !cond.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {cond.value ? format(new Date(cond.value + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={cond.value ? new Date(cond.value + "T00:00:00") : undefined} onSelect={(d) => updateCondition(idx, "value", d ? format(d, "yyyy-MM-dd") : "")} initialFocus />
                        </PopoverContent>
                      </Popover>
                    ) : cond.field === "assigned_to" ? (
                      <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select user" /></SelectTrigger>
                        <SelectContent>
                          {(members || []).map((m: any) => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={cond.value} onChange={(e) => updateCondition(idx, "value", e.target.value)} placeholder="value" className="flex-1" />
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} type="button">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <Label>Actions (run in sequence) *</Label>
              {ruleActions.length === 0 && (
                <p className="text-xs text-muted-foreground">No actions yet. Add at least one action.</p>
              )}
              {ruleActions.map((act, idx) => (
                <Card key={idx} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                      <Select value={act.type} onValueChange={(v) => setActionType(idx, v)}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="change_status">Change Task Status</SelectItem>
                          <SelectItem value="assign_user">Assign to Member</SelectItem>
                          <SelectItem value="assign_role">Assign to Role</SelectItem>
                          <SelectItem value="add_comment">Add Comment to Task</SelectItem>
                          <SelectItem value="resolve_blocker">Resolve the Blocker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAction(idx)} type="button">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {act.type === "change_status" && (
                    <Select value={act.params.status_id || ""} onValueChange={(v) => setActionParam(idx, "status_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select target status" /></SelectTrigger>
                      <SelectContent>
                        {(workflowStatuses || []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {act.type === "assign_user" && (
                    <Select value={act.params.user_id || ""} onValueChange={(v) => setActionParam(idx, "user_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                      <SelectContent>
                        {(members || []).map((m: any) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {act.type === "assign_role" && (
                    <Select value={act.params.role_id || ""} onValueChange={(v) => setActionParam(idx, "role_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {(projectRoles || []).map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {act.type === "add_comment" && (
                    <Textarea value={act.params.body || ""} onChange={(e) => setActionParam(idx, "body", e.target.value)} placeholder="Comment text" rows={2} />
                  )}
                  {act.type === "resolve_blocker" && (
                    <p className="text-xs text-muted-foreground">This action resolves the blocker that triggered the rule. No additional parameters needed.</p>
                  )}
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addAction} type="button">
                <Plus className="h-4 w-4" /> Add Action
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetRuleForm(); setAutomationRulesOpen(false); }}>Cancel</Button>
              <Button type="submit">{editRuleId ? "Update Rule" : "Create Rule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRuleConfirmId} onOpenChange={(o) => { if (!o) setDeleteRuleConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation Rule?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteRuleConfirmId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAutomationRule}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTaskConfirmId} onOpenChange={(o) => { if (!o) setDeleteTaskConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this task and its blockers. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTaskConfirmId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bulk Add Tasks</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">CSV Format</p>
              <p className="text-xs text-muted-foreground">Your CSV must have these column headers on the first row:</p>
              <div className="bg-muted rounded p-2 text-xs font-mono">title,description,priority,estimated_hours,due_date,client_visible</div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                <li><strong>title</strong> — required</li>
                <li><strong>description</strong> — optional</li>
                <li><strong>priority</strong> — must be one of: high, medium, low (case-insensitive, defaults to medium)</li>
                <li><strong>estimated_hours</strong> — optional decimal number (e.g. 1, 1.5, 2.25)</li>
                <li><strong>due_date</strong> — optional date (YYYY-MM-DD)</li>
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
                        <th className="text-left p-2 font-medium">Visible</th>
                        <th className="text-left p-2 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r) => (
                        <tr key={r.rowNum} className={r.errors.length > 0 ? "bg-red-50" : "border-t"}>
                          <td className="p-2 text-muted-foreground">{r.rowNum}</td>
                          <td className={`p-2 font-medium ${!r.title ? "text-red-500" : ""}`}>{r.title || <span className="italic text-red-400">empty</span>}</td>
                          <td className="p-2 text-muted-foreground">{truncateWords(r.description, 4) || "—"}</td>
                          <td className="p-2">
                            <Badge className={PRIORITY_COLORS[r.priority] || ""}>{r.priority}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">{r.estimated_hours || "—"}</td>
                          <td className="p-2 text-muted-foreground">{r.due_date || "—"}</td>
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
        if (!open) setDependencyWarning("");
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
            {viewTaskData?.status && <Badge className={TASK_STATUS_COLORS[viewTaskData.status] || ""}>{viewTaskData.status.replace(/_/g, " ")}</Badge>}
            {viewTaskData?.estimated_hours && <span className="text-xs text-muted-foreground">{viewTaskData.estimated_hours}h est.</span>}
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
                           return m.users?.role === "client member" || m.users?.role === "client portal";
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
                  <div className="mt-2 space-y-2" onClick={(e2) => e2.stopPropagation()}>
                    <Select value={showOtherRole[e.id] ? "__other__" : roleInputs[e.id] || ""} onValueChange={(v) => {
                      if (v === "__other__") {
                        setShowOtherRole({ ...showOtherRole, [e.id]: true });
                        setRoleInputs({ ...roleInputs, [e.id]: "" });
                      } else {
                        setShowOtherRole({ ...showOtherRole, [e.id]: false });
                        setRoleInputs({ ...roleInputs, [e.id]: v });
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                      <SelectContent>
                        {projectRoles.map((r: any) => (
                          <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                        ))}
                        <SelectItem value="__other__">Other…</SelectItem>
                      </SelectContent>
                    </Select>
                    {showOtherRole[e.id] && (
                      <Input placeholder="Enter role name" value={roleInputs[e.id] || ""} onChange={(e2) => setRoleInputs({ ...roleInputs, [e.id]: e2.target.value })} />
                    )}
                  </div>
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
          <DialogHeader><DialogTitle>{selectedPhase?.title}</DialogTitle></DialogHeader>
          <Tabs defaultValue="sprints">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sprints">Sprints</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>
            <TabsContent value="sprints" className="space-y-2 max-h-80 overflow-y-auto">
              {(() => {
                const phaseSprints = (sprints || []).filter((s: any) => s.phase_id === selectedPhase?.id);
                if (phaseSprints.length === 0) return <p className="text-sm text-muted-foreground py-4">No sprints in this phase.</p>;
                return phaseSprints.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">{format(new Date(s.start_date + "T00:00:00"), "MMM d")} – {format(new Date(s.end_date + "T00:00:00"), "MMM d")}</Badge>
                      <Badge className={
                        s.status === "active" ? "bg-green-100 text-green-800" :
                        s.status === "completed" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-800"
                      }>{s.status}</Badge>
                      <Badge variant="secondary" className="text-xs">{sprintTaskCount[s.id] || 0} tasks</Badge>
                    </div>
                  </div>
                ));
              })()}
            </TabsContent>
            <TabsContent value="tasks" className="space-y-2 max-h-80 overflow-y-auto">
              {(() => {
                const phaseTasks = (tasks || []).filter((t: any) => t.phase_id === selectedPhase?.id);
                if (phaseTasks.length === 0) return <p className="text-sm text-muted-foreground py-4">No tasks assigned to this phase.</p>;
                return phaseTasks.map((t: any) => (
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
                ));
              })()}
            </TabsContent>
          </Tabs>
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
              <label className="text-sm font-medium">Phase *</label>
              <Select value={sprintPhaseId} onValueChange={setSprintPhaseId}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {(phases || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <label className="text-sm font-medium">Phase *</label>
              <Select value={editSprintPhaseId} onValueChange={setEditSprintPhaseId}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {(phases || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Remove Dependency Confirmation */}
      <AlertDialog open={!!confirmDepDelId} onOpenChange={(open) => !open && setConfirmDepDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove dependency?</AlertDialogTitle>
            <AlertDialogDescription>This will unlink the dependency between these tasks.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDepDelId && confirmDepDelTaskId) removeDependency(confirmDepDelId, confirmDepDelTaskId); setConfirmDepDelId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!confirmMemberDelId} onOpenChange={(open) => !open && setConfirmMemberDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>This will remove them from the project. They can be re-added later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmMemberDelId && confirmMemberDelUserId) removeMember(confirmMemberDelId, confirmMemberDelUserId); setConfirmMemberDelId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
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

      {/* Delete Phase Confirmation */}
      <AlertDialog open={!!confirmPhaseDelId} onOpenChange={(open) => !open && setConfirmPhaseDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete phase?</AlertDialogTitle>
            <AlertDialogDescription>This will unlink all tasks from this phase and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmPhaseDelId) deletePhase(confirmPhaseDelId); setConfirmPhaseDelId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          {projectSettings ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#111827]">Project Status</h3>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#374151]">Status</label>
                  <Select value={project.status} onValueChange={changeStatus}>
                    <SelectTrigger className="border-[#E5E7EB] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#374151]">Status Note</label>
                  <div className="flex gap-2">
                    <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} className="flex-1 border-[#E5E7EB] text-sm resize-none" />
                    <Button variant="outline" size="sm" onClick={saveStatusNote} className="self-end border-[#E5E7EB]">Save</Button>
                  </div>
                </div>
              </div>
              <div className="border-t border-[#E5E7EB] pt-4">
                <h3 className="text-sm font-semibold text-[#111827] mb-3">Automation Settings</h3>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveProjectSettings({ at_risk_variance_percent: Number(fd.get("at_risk_variance_percent")), delayed_variance_percent: Number(fd.get("delayed_variance_percent")), blocker_warning_days: Number(fd.get("blocker_warning_days")), critical_blocker_warning_days: Number(fd.get("critical_blocker_warning_days")), hours_per_day: Number(fd.get("hours_per_day")) }); }} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">At Risk Variance (%)</label>
                    <Input name="at_risk_variance_percent" type="number" min="0" step="1" defaultValue={projectSettings.at_risk_variance_percent} />
                    <p className="text-[11px] text-muted-foreground">Burndown variance % that moves health to "at risk"</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Delayed Variance (%)</label>
                    <Input name="delayed_variance_percent" type="number" min="0" step="1" defaultValue={projectSettings.delayed_variance_percent} />
                    <p className="text-[11px] text-muted-foreground">Burndown variance % that moves health to "delayed"</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Blocker Warning (days)</label>
                    <Input name="blocker_warning_days" type="number" min="1" step="1" defaultValue={projectSettings.blocker_warning_days} />
                    <p className="text-[11px] text-muted-foreground">Open blocker age in days before it contributes to "delayed"</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Critical Blocker Warning (days)</label>
                    <Input name="critical_blocker_warning_days" type="number" min="1" step="1" defaultValue={projectSettings.critical_blocker_warning_days} />
                    <p className="text-[11px] text-muted-foreground">Blocker on critical-path task age in days before "delayed"</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Hours Per Day</label>
                    <Input name="hours_per_day" type="number" min="1" step="0.5" defaultValue={projectSettings.hours_per_day} />
                    <p className="text-[11px] text-muted-foreground">Used to convert estimated hours to calendar days for critical path</p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Loading settings...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
