import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useWorkSettings, getPKTDateString } from "@/hooks/useWorkSettings";
import { createNotification, createProjectRelatedNotifications, getClientMemberIds, getAdminManagerIds } from "@/lib/notification-helpers";
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
import { ArrowLeft, Plus, Trash2, Download, Search, ExternalLink, Upload, Pencil, Flag, Eye, EyeOff, MessageSquare, AlertCircle, CheckCircle2, XCircle, Info, Settings, ChevronDown, ChevronRight, Send, X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

import { PROJECT_STATUS_OPTIONS as STATUS_OPTIONS, PROJECT_STATUS_COLORS as STATUS_COLORS, getAllowedTransitions, getStatusColor, getDoneStatusIds, getInitialStatus, getStatusDisplay } from "@/lib/workflow";
import { StageOutcomeSelector } from "@/components/StageOutcomeSelector";
import { getUnfinishedDependencies, isDependencyWarnTarget } from "@/lib/dependencies";
const CHART_COLORS = ["hsl(82,100%,72%)", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];

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
  const isClient = profile?.role === "client" || profile?.role === "client member";

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
  const [taskDateOpen, setTaskDateOpen] = useState(false);
  const [taskClientVisible, setTaskClientVisible] = useState(true);
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskEstimatedHours, setEditTaskEstimatedHours] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskDateOpen, setEditTaskDateOpen] = useState(false);
  const [editTaskClientVisible, setEditTaskClientVisible] = useState(true);
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [kanbanSprintFilter, setKanbanSprintFilter] = useState<string>("all");
  const [kanbanPriorityFilter, setKanbanPriorityFilter] = useState<string>("all");
  const [csvRows, setCsvRows] = useState<{ rowNum: number; title: string; description: string; priority: string; estimated_hours: string; due_date: string; client_visible: string; assigned_to: string; resolvedId: string | null; isDuplicate: boolean; existingTaskId: string | null; errors: string[] }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replaceDuplicates, setReplaceDuplicates] = useState(false);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseDueDate, setPhaseDueDate] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [phaseTasksOpen, setPhaseTasksOpen] = useState(false);
  const [confirmPhaseDelId, setConfirmPhaseDelId] = useState<string | null>(null);
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
  const [sprintTaskIds, setSprintTaskIds] = useState<string[]>([]);
  const [sprintTaskSearch, setSprintTaskSearch] = useState("");
  const [editSprintOpen, setEditSprintOpen] = useState(false);
  const [editSprintId, setEditSprintId] = useState<string | null>(null);
  const [editSprintName, setEditSprintName] = useState("");
  const [editSprintStartDate, setEditSprintStartDate] = useState("");
  const [editSprintEndDate, setEditSprintEndDate] = useState("");
  const [editSprintStatus, setEditSprintStatus] = useState("");
  const [editSprintPhaseId, setEditSprintPhaseId] = useState("");
  const [editSprintTaskIds, setEditSprintTaskIds] = useState<string[]>([]);

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
const [ruleDatePickerOpenIdx, setRuleDatePickerOpenIdx] = useState<number | null>(null);
const [ruleStatus, setRuleStatus] = useState("draft");
const [ruleTriggerType, setRuleTriggerType] = useState("status_change");
const [rulePriority, setRulePriority] = useState(0);
const [ruleAllowTriggering, setRuleAllowTriggering] = useState(false);
const [ruleConditions, setRuleConditions] = useState<{field: string; operator: string; value: string}[]>([]);
const [ruleActions, setRuleActions] = useState<{type: string; params: Record<string, string>}[]>([]);
const [deleteRuleConfirmId, setDeleteRuleConfirmId] = useState<string | null>(null);
  const [deleteTaskConfirmId, setDeleteTaskConfirmId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkTaskDeleteOpen, setBulkTaskDeleteOpen] = useState(false);

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

  const { data: members } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const [membersResult, logsResult] = await Promise.all([
        supabase.from("project_members").select("*, users(id, full_name, designation, avatar_url, role), project_roles(name)").eq("project_id", id!).is("removed_at", null),
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

  const resourceMembers = (members || []).filter((m: any) => !["Client", "Client Member"].includes((m.users as any)?.designation));
  const clientMembers = (members || []).filter((m: any) => ["Client", "Client Member"].includes((m.users as any)?.designation));

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

  const doneStatusIds = useMemo(() => getDoneStatusIds(workflowStatuses || []), [workflowStatuses]);
  const initialStatus = useMemo(() => getInitialStatus(workflowStatuses || []), [workflowStatuses]);
  const statusColor = useCallback(
    (statusId: string | null) => getStatusColor(workflowStatuses || [], statusId),
    [workflowStatuses]
  );

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
  const [viewDependencyWarning, setViewDependencyWarning] = useState("");
  useEffect(() => {
    setViewDependencyWarning("");
  }, [viewTaskData]);
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

  const sprintMap = useMemo(() => {
    const m: Record<string, string> = {};
    (sprints || []).forEach((s: any) => { m[s.id] = s.name; });
    return m;
  }, [sprints]);

  const sprintProgress = useMemo(() => {
    const progress: Record<string, number> = {};
    (sprints || []).forEach((s: any) => {
      const sprintTasks = (tasks || []).filter((t: any) => t.sprint_id === s.id);
      if (sprintTasks.length === 0) {
        progress[s.id] = 0;
      } else {
        const completed = sprintTasks.filter((t: any) => doneStatusIds.has(t.status_id)).length;
        progress[s.id] = Math.round((completed / sprintTasks.length) * 100);
      }
    });
    return progress;
  }, [sprints, tasks]);

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

    const { data: blockerTask } = await supabase.from("tasks").select("assigned_to, title").eq("id", taskId).single();
    if (blockerTask?.assigned_to && blockerTask.assigned_to !== profile.id) {
      await createNotification({
        userId: blockerTask.assigned_to,
        type: "blocker_created",
        title: "New Blocker on Your Task",
        message: `A blocker was added to your task "${blockerTask.title}"`,
        projectId: projectId,
      });
    }
  };

  const addViewBlocker = async () => {
    if (!newViewBlockerDescription.trim() || !viewTaskData?.id || !profile) return;
    if (viewTaskData.status_id && doneStatusIds.has(viewTaskData.status_id)) {
      toast.error("Cannot add blockers to a completed task");
      return;
    }
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
            type: "blocker_created",
            title: "Blocker Assigned to You",
            message: `A blocker has been assigned to you for task "${viewTaskData.title}" in project "${project?.name}"`,
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
    
    let blockerAssigneeInfo = "";
    if (newBlockerAssignUserId) {
      if (newBlockerAssignType === "client") {
        blockerAssigneeInfo = `client ${project?.clients?.name || "client"}`;
      } else {
        const { data: assigneeUser } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", newBlockerAssignUserId)
          .single();
        blockerAssigneeInfo = assigneeUser?.full_name || "user";
      }
    }
    const assigneeSuffix = blockerAssigneeInfo ? ` (assigned to ${blockerAssigneeInfo})` : "";

    const message = `${profile.full_name} created a blocker on task "${viewTaskData.title}"${assigneeSuffix} in project "${project?.name}"`;
    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: viewTaskData.project_id,
      type: "blocker_created",
      title: "New Blocker Created",
      message,
      requiresClientAction: newBlockerVisibility === "all",
    });

    if (viewTaskData?.assigned_to && viewTaskData.assigned_to !== profile.id) {
      await createNotification({
        userId: viewTaskData.assigned_to,
        type: "blocker_created",
        title: "New Blocker on Your Task",
        message: `A blocker was added to your task "${viewTaskData.title}" in project "${project?.name}"`,
        projectId: viewTaskData.project_id,
      });
    }

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
      .select("*, project_id, task_id, tasks!inner(title)")
      .eq("id", blockerId);
    
    if (blockers?.[0]) {
      const blocker = blockers[0];
      const blockerTaskTitle = (blocker as any).tasks?.title || "(unknown task)";
      const isClientAction = blocker.requires_client_action || false;
      const message = `${profile.full_name} resolved a blocker on task "${blockerTaskTitle}" in project "${project?.name}"`;
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
            message: `"${item.title}" was automatically completed due to blocker resolution in project "${project?.name}"`,
          });
        }
        queryClient.invalidateQueries({ queryKey: ["project-action-items", blocker.project_id] });
      }
    }

    const { data: resolveTask } = await supabase.from("tasks").select("assigned_to, title").eq("id", taskId).single();
    if (resolveTask?.assigned_to && resolveTask.assigned_to !== profile.id) {
      await createNotification({
        userId: resolveTask.assigned_to,
        type: "blocker_resolved",
        title: "Blocker Resolved on Your Task",
        message: `A blocker on your task "${resolveTask.title}" in project "${project?.name}" was resolved`,
        projectId: viewTaskData?.project_id || id,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["project-tasks", viewTaskData?.project_id || id] });
    const { data: updatedTask } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    if (updatedTask) setViewTaskData(updatedTask);
  };

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
    if (viewTaskData.status_id && doneStatusIds.has(viewTaskData.status_id)) {
      toast.error("Cannot add dependencies to a completed task");
      return;
    }
    const { error } = await supabase.from("task_dependencies").insert({
      task_id: viewTaskData.id,
      depends_on_task_id: viewAddDepTaskId,
      dependency_type: viewAddDepType,
      created_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }

    const { data: depTask } = await supabase
      .from("tasks")
      .select("title, assigned_to")
      .eq("id", viewAddDepTaskId)
      .single();

    if (depTask?.assigned_to) {
      const { error: aiError } = await supabase.from("client_action_items").insert({
        project_id: viewTaskData.project_id,
        title: `Complete ${depTask.title} — ${viewTaskData.title} depends on it`,
        status: "pending",
        requested_by: profile.id,
        assigned_to: depTask.assigned_to,
        priority: "medium",
        visible_to_client: false,
      });

      if (!aiError) {
        await createNotification({
          userId: depTask.assigned_to,
          type: "action_item_created",
          title: "New Action Item (Dependency)",
          message: `Complete "${depTask.title}" — "${viewTaskData.title}" depends on it`,
          projectId: viewTaskData.project_id,
        });
      }
    }

    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: viewTaskData.project_id,
      type: "action_item_created",
      title: "New Dependency Action Item",
      message: `${profile.full_name} created a dependency: Complete "${depTask?.title || "(untitled)"}" — "${viewTaskData.title}" depends on it`,
    });
    queryClient.invalidateQueries({ queryKey: ["project-action-items", viewTaskData.project_id] });

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
    
    let aiAssigneeInfo = "";
    if (newActionItemAssignedTo) {
      const { data: aiUser } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", newActionItemAssignedTo)
        .single();
      aiAssigneeInfo = aiUser?.full_name || "user";
    }
    const aiAssigneeSuffix = aiAssigneeInfo ? ` (assigned to ${aiAssigneeInfo})` : "";

    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: id,
      type: "action_item_created",
      title: "New Action Item",
      message: `${profile.full_name} created action item "${newActionItemTitle.trim()}"${aiAssigneeSuffix} in project "${project?.name}"`,
    });

    if (newActionItemAssignedTo) {
      await createNotification({
        userId: newActionItemAssignedTo,
        type: "action_item_created",
        title: "New Action Item Assigned",
        message: `A new action item "${newActionItemTitle.trim()}" has been assigned to you in project "${project?.name}"`,
        projectId: id,
      });
    }

    if (newActionItemVisible && newActionItemBlockerId) {
      const clientIds = await getClientMemberIds(id);
      for (const clientId of clientIds) {
        await createNotification({
          userId: clientId,
          type: "action_item_linked",
          title: "Action Required (Blocker)",
          message: `A new action item "${newActionItemTitle.trim()}" is linked to an active blocker and requires your attention in project "${project?.name}"`,
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
    const { data: delTask } = await supabase
      .from("tasks")
      .select("status_id, title")
      .eq("id", deleteTaskConfirmId)
      .single();
    if (delTask?.status_id && doneStatusIds.has(delTask.status_id)) {
      toast.warning("Deleting a completed task — this will remove history");
    }
    const { error } = await supabase.from("tasks").delete().eq("id", deleteTaskConfirmId);
    if (error) { toast.error(error.message); return; }
    setDeleteTaskConfirmId(null);
    toast.success("Task deleted");
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    
    await createProjectRelatedNotifications({
      createdByUserId: profile?.id || "",
      projectId: id,
      type: "task_deleted",
      title: "Task Deleted",
      message: `${profile?.full_name || "A user"} deleted task "${delTask?.title || "(untitled)"}" in project "${project?.name}"`,
    });
  };

  const bulkDeleteTasks = async () => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    const { error } = await supabase.from("tasks").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    setSelectedTaskIds(new Set());
    setBulkTaskDeleteOpen(false);
    toast.success(`${ids.length} task(s) deleted`);
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

    const { data: completedItem } = await supabase
      .from("client_action_items")
      .select("title")
      .eq("id", itemId)
      .single();

    const completedTitle = completedItem?.title || "(untitled)";
    await createProjectRelatedNotifications({
      createdByUserId: profile.id,
      projectId: id,
      type: "action_item_completed",
      title: "Action Item Completed",
      message: `${profile.full_name} completed action item "${completedTitle}" in project "${project?.name}"`,
    });
  };

  const createSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStartDate || !sprintEndDate || !id) return;
    const { data: newSprint, error } = await supabase.from("sprints").insert({
      project_id: id,
      phase_id: sprintPhaseId || null,
      name: sprintName.trim(),
      start_date: sprintStartDate,
      end_date: sprintEndDate,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (sprintTaskIds.length > 0 && newSprint) {
      const currentWorkflowStatusIds = new Set(workflowStatuses?.map((s: any) => s.id) || []);
      const assignTasks = (tasks || []).filter((t: any) => sprintTaskIds.includes(t.id));
      const validTasks = assignTasks.filter((t: any) => currentWorkflowStatusIds.has(t.status_id));
      const orphanedTasks = assignTasks.filter((t: any) => !currentWorkflowStatusIds.has(t.status_id));
      if (validTasks.length > 0) {
        const { error } = await supabase.from("tasks").update({
          sprint_id: newSprint.id,
          status_id: initialStatus?.id || null,
        }).in("id", validTasks.map((t: any) => t.id));
        if (error) { toast.error(error.message); return; }
      }
      if (orphanedTasks.length > 0) {
        const { error } = await supabase.from("tasks").update({
          sprint_id: newSprint.id,
        }).in("id", orphanedTasks.map((t: any) => t.id));
        if (error) { toast.error(error.message); return; }
      }
    }
    toast.success("Sprint created");
    setAddSprintOpen(false);
    setSprintName("");
    setSprintStartDate("");
    setSprintEndDate("");
    setSprintPhaseId("");
    setSprintTaskIds([]);
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  const openEditSprint = (sprint: any) => {
    setEditSprintId(sprint.id);
    setEditSprintName(sprint.name);
    setEditSprintStartDate(sprint.start_date);
    setEditSprintEndDate(sprint.end_date);
    setEditSprintStatus(sprint.status);
    setEditSprintPhaseId(sprint.phase_id);
    setEditSprintTaskIds((tasks || []).filter((t: any) => t.sprint_id === sprint.id).map((t: any) => t.id));
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
      updates.status = editSprintStatus;
    }
    const { error } = await supabase.from("sprints").update(updates).eq("id", editSprintId);
    if (error) { toast.error(error.message); return; }
    const previouslyAssigned = (tasks || []).filter((t: any) => t.sprint_id === editSprintId);
    const toUnassign = previouslyAssigned.filter((t: any) => !editSprintTaskIds.includes(t.id));
    const toUnassignIds = toUnassign.map((t: any) => t.id);
    const unlinkedStatus = initialStatus;
    const linkedStatus = initialStatus;
    const currentWorkflowStatusIds = new Set(workflowStatuses?.map((s: any) => s.id) || []);
    if (toUnassignIds.length > 0) {
      const validUnassign = toUnassign.filter((t: any) => currentWorkflowStatusIds.has(t.status_id));
      const orphanedUnassign = toUnassign.filter((t: any) => !currentWorkflowStatusIds.has(t.status_id));
      if (validUnassign.length > 0) {
        const { error } = await supabase.from("tasks").update({
          sprint_id: null,
          status_id: unlinkedStatus?.id || null,
        }).in("id", validUnassign.map((t: any) => t.id));
        if (error) { toast.error(error.message); return; }
      }
      if (orphanedUnassign.length > 0) {
        const { error } = await supabase.from("tasks").update({
          sprint_id: null,
        }).in("id", orphanedUnassign.map((t: any) => t.id));
        if (error) { toast.error(error.message); return; }
      }
    }
    if (editSprintTaskIds.length > 0) {
      const assignTasks = (tasks || []).filter((t: any) => editSprintTaskIds.includes(t.id));
      const validAssign = assignTasks.filter((t: any) => currentWorkflowStatusIds.has(t.status_id));
      const orphanedAssign = assignTasks.filter((t: any) => !currentWorkflowStatusIds.has(t.status_id));
      if (validAssign.length > 0) {
        const { error } = await supabase.from("tasks").update({
          sprint_id: editSprintId,
          status_id: linkedStatus?.id || null,
        }).in("id", validAssign.map((t: any) => t.id));
        if (error) { toast.error(error.message); return; }
      }
      if (orphanedAssign.length > 0) {
        const { error } = await supabase.from("tasks").update({
          sprint_id: editSprintId,
        }).in("id", orphanedAssign.map((t: any) => t.id));
        if (error) { toast.error(error.message); return; }
      }
    }
    toast.success("Sprint updated");
    setEditSprintOpen(false);
    setEditSprintId(null);
    setEditSprintTaskIds([]);
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  const deleteSprint = async (sprintId: string) => {
    if (!confirm("Delete this sprint? Tasks will be unassigned from it.")) return;
    const currentWorkflowStatusIds = new Set(workflowStatuses?.map((s: any) => s.id) || []);
    const sprintTasks = (tasks || []).filter((t: any) => t.sprint_id === sprintId);
    const validTasks = sprintTasks.filter((t: any) => currentWorkflowStatusIds.has(t.status_id));
    const orphanedTasks = sprintTasks.filter((t: any) => !currentWorkflowStatusIds.has(t.status_id));
    if (validTasks.length > 0) {
      const { error: unassignErr } = await supabase.from("tasks").update({
        sprint_id: null,
        status_id: initialStatus?.id || null,
      }).in("id", validTasks.map((t: any) => t.id));
      if (unassignErr) { toast.error(unassignErr.message); return; }
    }
    if (orphanedTasks.length > 0) {
      const { error: orphanErr } = await supabase.from("tasks").update({
        sprint_id: null,
      }).in("id", orphanedTasks.map((t: any) => t.id));
      if (orphanErr) { toast.error(orphanErr.message); return; }
    }
    const { error } = await supabase.from("sprints").delete().eq("id", sprintId);
    if (error) { toast.error(error.message); return; }
    toast.success("Sprint deleted");
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  const openSprintTasks = (sprint: any) => {
    setSelectedSprint(sprint);
    setSprintTasksOpen(true);
  };

  const phaseProgress = useMemo(() => {
    const progress: Record<string, number> = {};
    (phases || []).forEach((p: any) => {
      const phaseSprints = (sprints || []).filter((s: any) => s.phase_id === p.id);
      if (phaseSprints.length === 0) {
        progress[p.id] = 0;
      } else {
        const completed = phaseSprints.filter((s: any) => s.status === "completed").length;
        progress[p.id] = Math.round((completed / phaseSprints.length) * 100);
      }
    });
    return progress;
  }, [phases, sprints]);

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
        ? e.designation === "Client" || e.designation === "Client Member"
        : e.designation !== "Client" && e.designation !== "Client Member";
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
        const roleName = emp?.designation || "Member";
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
        due_date: taskDueDate || null,
        client_visible: taskClientVisible,
        assigned_to: taskAssignedTo || null,
        sprint_id: taskSprintId || null,
        status_id: initialStatus?.id || null,
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
      
      await createProjectRelatedNotifications({
        createdByUserId: profile?.id || "",
        projectId: id!,
        type: "task_created",
        title: "Task Created",
        message: `${profile?.full_name || "A user"} created task "${taskTitle.trim()}" in project "${project?.name}"`,
      });
    } catch (err: any) { toast.error(err.message); }
  };

  const openEditTask = (task: any) => {
    if (task.status_id && doneStatusIds.has(task.status_id)) {
      toast.error("Cannot edit a completed task");
      return;
    }
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
      const { data: oldTask } = await supabase
        .from("tasks")
        .select("assigned_to, completed_at, status_id")
        .eq("id", editTaskId)
        .single();

      const updates: any = {
        title: editTaskTitle.trim(),
        description: editTaskDescription.trim() || null,
        priority: editTaskPriority,
        estimated_hours: editTaskEstimatedHours ? parseFloat(editTaskEstimatedHours) : null,
        due_date: editTaskDueDate || null,
        client_visible: editTaskClientVisible,
        assigned_to: editTaskAssignedTo || null,
        sprint_id: editTaskSprintId || null,
        status_id: initialStatus?.id || null,
      };

      const oldAssignedTo = oldTask?.assigned_to;
      const wasCompleted = !!oldTask?.completed_at;

      if (wasCompleted) {
        toast.error("Cannot edit a completed task");
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editTaskId);
      if (error) throw error;
      toast.success("Task updated");
      // Automation rules for status_change are now fired automatically by
      // the trg_run_automation_on_status_change database trigger whenever
      // status_id changes — no manual RPC call needed here.

      const newAssignedTo = updates.assigned_to;
      if (newAssignedTo && oldAssignedTo !== newAssignedTo) {
        await createNotification({
          userId: newAssignedTo,
          type: "task_assigned",
          title: "Task Assigned",
          message: `You have been assigned to task "${editTaskTitle.trim()}" in project "${project?.name}"`,
          projectId: id,
        });
      }

      if (wasCompleted) {
        const adminIds = await getAdminManagerIds(profile?.id);
        const notifyIds = new Set(adminIds);
        if (oldAssignedTo) notifyIds.add(oldAssignedTo);
        const notifications = Array.from(notifyIds).map((userId) => ({
          user_id: userId,
          type: "task_returned",
          channel: "in_app",
          metadata: { title: "Task Returned", message: `${profile.full_name} moved task "${editTaskTitle.trim()}" back from completed in project "${project?.name}"`, project_id: id },
          read: false,
        }));
        if (notifications.length > 0) await supabase.from("notifications").insert(notifications);
      }

      await createProjectRelatedNotifications({
        createdByUserId: profile?.id || "",
        projectId: id!,
        type: "task_edited",
        title: "Task Updated",
        message: `${profile?.full_name || "A user"} updated task "${editTaskTitle.trim()}" in project "${project?.name}"`,
      });

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

    const parseDateFlexible = (dateStr: string): string | null => {
      const trimmed = dateStr.trim();
      if (!trimmed) return null;
      const native = Date.parse(trimmed);
      if (!isNaN(native)) return new Date(native).toISOString().split("T")[0];
      const normalized = trimmed.replace(/-/g, "/");
      const normalizedParsed = Date.parse(normalized);
      if (!isNaN(normalizedParsed)) return new Date(normalizedParsed).toISOString().split("T")[0];
      const parts = trimmed.split(/[/\-\.]/);
      if (parts.length === 3 && parseInt(parts[0]) > 12) {
        const swapped = `${parts[1]}/${parts[0]}/${parts[2]}`;
        const swappedParsed = Date.parse(swapped);
        if (!isNaN(swappedParsed)) return new Date(swappedParsed).toISOString().split("T")[0];
      }
      return null;
    };

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
      const assignedToIdx = headers.indexOf("assigned_to");
      if (titleIdx === -1) {
        toast.error("CSV must have a 'title' column");
        return;
      }
      const rows: { rowNum: number; title: string; description: string; priority: string; estimated_hours: string; due_date: string; client_visible: string; assigned_to: string; resolvedId: string | null; isDuplicate: boolean; existingTaskId: string | null; errors: string[] }[] = [];
      const employeeNameToId: Record<string, string> = {};
      (allEmployees || []).forEach((e: any) => {
        const fullName = (e.full_name || "").trim().toLowerCase();
        if (fullName) employeeNameToId[fullName] = e.user_id || e.id;
      });
      const existingTaskTitles = new Map(
        (tasks || []).map((t: any) => [t.title.trim().toLowerCase(), t])
      );
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = cols[titleIdx]?.trim() || "";
        const description = descIdx !== -1 ? (cols[descIdx]?.trim() || "") : "";
        let priority = prioIdx !== -1 ? (cols[prioIdx]?.trim().toLowerCase() || "") : "";
        const estimated_hours = estIdx !== -1 ? (cols[estIdx]?.trim() || "") : "";
        const due_date = dueDateIdx !== -1 ? (cols[dueDateIdx]?.trim() || "") : "";
        const client_visible = clientVisIdx !== -1 ? (cols[clientVisIdx]?.trim().toLowerCase() || "") : "";
        const assigned_to = assignedToIdx !== -1 ? (cols[assignedToIdx]?.trim() || "") : "";
        const errors: string[] = [];
        if (!title) errors.push("Title is required");
        if (priority && !VALID_PRIORITIES.includes(priority)) {
          errors.push(`Invalid priority "${priority}", defaulting to medium`);
          priority = "medium";
        }
        if (!priority) priority = "medium";
        if (estimated_hours && isNaN(Number(estimated_hours))) errors.push("Invalid estimated_hours");
        const parsedDueDate = parseDateFlexible(due_date);
        if (due_date && !parsedDueDate) errors.push("Invalid due_date");
        if (client_visible && !["true", "false", "yes", "no", "1", "0"].includes(client_visible)) errors.push("Invalid client_visible");
        const resolvedId = assigned_to ? (employeeNameToId[assigned_to.trim().toLowerCase()] || null) : null;
        if (assigned_to && !resolvedId) errors.push(`Employee "${assigned_to}" not found`);
        const isDuplicate = title ? existingTaskTitles.has(title.trim().toLowerCase()) : false;
        const existingTask = isDuplicate ? existingTaskTitles.get(title.trim().toLowerCase()) : null;
        rows.push({ rowNum: i, title, description, priority, estimated_hours, due_date: parsedDueDate || due_date, client_visible, assigned_to, resolvedId, isDuplicate, existingTaskId: existingTask?.id || null, errors });
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkUpload = async () => {
    const validRows = csvRows.filter((r) => r.errors.length === 0 || r.errors.every((err) => err.startsWith("Invalid priority") || err.startsWith("Duplicate")));
    if (validRows.length === 0) {
      toast.error("No valid rows to upload");
      return;
    }
    setUploading(true);
    try {
      const initialStatus = workflowStatuses?.find((s: any) => s.is_initial);
      const newRows = validRows.filter(r => !r.isDuplicate);
      const dupRows = validRows.filter(r => r.isDuplicate);
      const inserts = newRows.map((r) => ({
        project_id: id!,
        title: r.title,
        description: r.description || null,
        priority: r.priority,
        estimated_hours: r.estimated_hours ? parseFloat(r.estimated_hours) : null,
        due_date: r.due_date || null,
        client_visible: !["false", "no", "0"].includes(r.client_visible),
        status_id: initialStatus?.id || null,
        created_by: profile?.id,
        assigned_to: r.resolvedId || null,
      }));
      if (inserts.length > 0) {
        const { error } = await supabase.from("tasks").insert(inserts);
        if (error) throw error;
      }
      let replacedCount = 0;
      if (replaceDuplicates && dupRows.length > 0) {
        for (const r of dupRows) {
          const { error } = await supabase.from("tasks").update({
            description: r.description || null,
            priority: r.priority,
            estimated_hours: r.estimated_hours ? parseFloat(r.estimated_hours) : null,
            due_date: r.due_date || null,
            client_visible: !["false", "no", "0"].includes(r.client_visible),
            assigned_to: r.resolvedId || null,
          }).eq("id", r.existingTaskId!);
          if (error) throw error;
          replacedCount++;
        }
      }
      const skippedCount = replaceDuplicates ? 0 : dupRows.length;
      const parts = [];
      if (inserts.length > 0) parts.push(`${inserts.length} added`);
      if (replacedCount > 0) parts.push(`${replacedCount} replaced`);
      if (skippedCount > 0) parts.push(`${skippedCount} duplicate(s) skipped`);
      toast.success(parts.length > 0 ? parts.join(", ") : "No changes made");
      setBulkTaskOpen(false);
      setCsvRows([]);
      setCsvFileName("");
      setReplaceDuplicates(false);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      
      await createProjectRelatedNotifications({
        createdByUserId: profile?.id || "",
        projectId: id!,
        type: "task_created",
        title: "Tasks Created (Bulk)",
        message: `${profile?.full_name || "A user"} added ${validRows.length} task(s) via CSV upload in project "${project?.name}"`,
      });
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const PRIORITY_COLORS: Record<string, string> = { high: "bg-red-100 text-red-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-green-100 text-green-800" };

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
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resources">Resources ({resourceMembers.length})</TabsTrigger>
          <TabsTrigger value="clients">Client's Member ({clientMembers.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="logs">Logs</TabsTrigger>}
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks?.length || 0})</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          {isAdmin && <TabsTrigger value="phases">Phases</TabsTrigger>}
          <TabsTrigger value="sprints">Sprints ({sprints?.length || 0})</TabsTrigger>
          {!isClient && <TabsTrigger value="action-items">Action Items ({isAdmin ? actionItems.length : actionItems.filter((a: any) => a.assigned_to === profile?.id).length})</TabsTrigger>}

          {isAdmin && <TabsTrigger value="automation-rules">Automation ({automationRules.length})</TabsTrigger>}

        </TabsList>
        )}

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
                <Button variant="outline" size="sm" className="rounded-button" asChild>
                  <a
                    href={(project as any).document_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Document
                  </a>
                </Button>
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

            {/* Portal Messages — visible to all */}
            {portalMessages.length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <h3 className="text-sm font-semibold">Messages</h3>
                {portalMessages.map((m: any) => (
                  <div key={m.id} className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <h4 className="text-sm font-semibold">{m.title}</h4>
                    {m.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.body}</p>}
                    {m.cta_label && m.cta_url && (
                      <a href={m.cta_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-2">
                        {m.cta_label} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Burndown Chart — admin/employee only (hours-based) */}
            {!isClient && (
              <>
                <Separator className="my-6" />

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
                      : (tasks || []).filter((t: any) => {
                          const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
                          return taskSprint?.phase_id === burndownScope;
                        })
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
              </>
            )}

            {/* Status Updates — admin/employee only */}
            {!isClient && (
              <>
                <Separator className="my-6" />

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
              </>
            )}
          </Card>
        </TabsContent>

        {/* Client-only tabs (rendered via sidebar sub-nav) */}
        {isClient && (
          <>
            <TabsContent value="phase-progress">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Phase Progress</h3>
              </div>
              {(() => {
                const clientPhaseProgress: Record<string, number> = {};
                const visiblePhases: any[] = [];
                (phases || []).forEach((p: any) => {
                  const phaseSprints = (sprints || []).filter((s: any) => s.phase_id === p.id);
                  if (phaseSprints.length === 0) {
                    clientPhaseProgress[p.id] = 0;
                  } else {
                    const completed = phaseSprints.filter((s: any) => s.status === "completed").length;
                    clientPhaseProgress[p.id] = Math.round((completed / phaseSprints.length) * 100);
                    visiblePhases.push(p);
                  }
                });

                if (visiblePhases.length === 0) {
                  return <Card className="p-6"><p className="text-muted-foreground">No phase progress to display.</p></Card>;
                }

                return (
                  <div>
                    <TableHeader gridCols="1fr 112px 192px">
                      <span>PHASE</span>
                      <span>DUE DATE</span>
                      <span>PROGRESS</span>
                    </TableHeader>
                    {visiblePhases.map((p: any) => (
                      <DataRow key={p.id} gridCols="1fr 112px 192px">
                        <div>
                          <RowPrimary className="whitespace-normal break-words">{p.title}</RowPrimary>
                          <RowSecondary>{(sprints || []).filter((s: any) => s.phase_id === p.id).length} sprints</RowSecondary>
                        </div>
                        <RowDataItem label="DUE DATE">{p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}</RowDataItem>
                        <RowDataItem label="PROGRESS">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${clientPhaseProgress[p.id]}%` }} />
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
                  : (tasks || []).filter((t: any) => {
                      const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
                      return t.client_visible === true && taskSprint?.phase_id === burndownScope;
                    })

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
                                  <td className="px-4 py-3 break-words">
                                    <div className="font-semibold text-[15px] text-[#111827] break-words">{t.title}</div>
                                    <div className="text-[12px] text-[#6b7280] mt-0.5 truncate">{truncateWords(t.description, 4) || "—"}</div>
                                  </td>
                                  <td className="px-4 py-3 break-words">
                                    <span className="text-[13px] text-[#374151]">{(t as any).users?.full_name || "—"}</span>
                                  </td>
                                  <td className="px-4 py-3 break-words">
                                    <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                                  </td>
                                  <td className="px-4 py-3 break-words">
                                    <Badge className={statusColor(t.status_id) || ""}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                                  </td>
                                  <td className="px-4 py-3 break-words">
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
                : (tasks || []).filter((t: any) => {
                    const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
                    return taskSprint?.phase_id === burndownScope;
                  })
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

        {/* TASKS — employees only (clients have their own view above) */}
        {!isAdmin && !isClient && (
          <TabsContent value="tasks" className="space-y-4">
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
                          <td className="px-4 py-3 break-words">
                            <div className="flex items-center gap-2">
                              <div className={"font-semibold text-[15px] text-[#111827] break-words" + (t.status_id && doneStatusIds.has(t.status_id) ? " line-through text-muted-foreground" : "")}>
                                {t.title}
                                {criticalTaskIds.has(t.id) && <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">Critical Path</Badge>}
                                {t.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === t.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">{s.name}</Badge> : null; })()}
                                {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5" />}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 break-words">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">STATUS</div>
                            <Badge className={statusColor(t.status_id) || ""}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                          </td>
                          <td className="px-4 py-3 break-words">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">EST. HOURS</div>
                            <span className="text-[13px] text-[#374151]">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</span>
                          </td>
                          <td className="px-4 py-3 break-words">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">PRIORITY</div>
                            <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                          </td>
                          <td className="px-4 py-3 break-words">
                            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">DUE DATE</div>
                            <span className="text-[13px] text-[#374151]">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</span>
                          </td>
                          <td className="px-4 py-3 break-words text-right">
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
          </TabsContent>
        )}

        {/* ACTION ITEMS — employees only */}
        {!isAdmin && !isClient && (
          <TabsContent value="action-items" className="space-y-4">
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
                    {(workflowStatuses || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setBulkTaskOpen(true)} className="rounded-button"><Upload className="h-4 w-4 mr-1" />Bulk Add Tasks</Button>
                <Button size="sm" onClick={() => setAddTaskOpen(true)} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Task</Button>
              </div>
            </div>

            {(() => {
              const filteredTasks = (tasks || []).filter(
                (t: any) => taskStatusFilter === "all" || t.status_id === taskStatusFilter
              );
              return filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <>
                {selectedTaskIds.size > 0 && (
                  <div className="flex items-center gap-3 bg-muted rounded-md px-4 py-2 mb-2">
                    <span className="text-sm font-medium">{selectedTaskIds.size} selected</span>
                    <Button variant="destructive" size="sm" onClick={() => setBulkTaskDeleteOpen(true)} className="rounded-button"><Trash2 className="h-4 w-4 mr-1" />Delete Selected</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTaskIds(new Set())}>Clear</Button>
                  </div>
                )}
                <table className="w-full">
                  <thead>
                    <tr className="hidden md:table-row border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.05em] text-[#9ca3af] font-medium">
                      <th className="px-4 py-2 text-left w-10">
                        <input type="checkbox" className="rounded" checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0} onChange={(e) => { if (e.target.checked) setSelectedTaskIds(new Set(filteredTasks.map((t: any) => t.id))); else setSelectedTaskIds(new Set()); }} />
                      </th>
                      <th className="px-4 py-2 text-left">TASK</th>
                      <th className="px-4 py-2 text-left">ASSIGNED TO</th>
                      <th className="px-4 py-2 text-left">PRIORITY</th>
                      <th className="px-4 py-2 text-left">STATUS</th>
                      <th className="px-4 py-2 text-left">EST. HOURS</th>
                      <th className="px-4 py-2 text-left">DUE DATE</th>
                      <th className="px-4 py-2 text-left">FLAGGED</th>
                      <th className="px-4 py-2 text-left">VISIBLE</th>
                      <th className="px-4 py-2 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                  {filteredTasks.map((t: any) => (
                    <tr key={t.id} className="bg-white hover:bg-[#f1f5f9] border-b border-[#f3f4f6] transition-colors">
                      <td className="px-4 py-3 break-words">
                        <input type="checkbox" className="rounded" checked={selectedTaskIds.has(t.id)} onChange={(e) => { const next = new Set(selectedTaskIds); if (e.target.checked) next.add(t.id); else next.delete(t.id); setSelectedTaskIds(next); }} />
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="font-semibold text-[15px] text-[#111827] break-words">
                          {t.title}
                          {criticalTaskIds.has(t.id) && <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">Critical Path</Badge>}
                          {t.sprint_id && (() => { const s = sprints.find((sp: any) => sp.id === t.sprint_id); return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">{s.name}</Badge> : null; })()}
                          {t.is_flagged && <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5 shrink-0" />}
                        </div>
                        <div className="text-[12px] text-[#6b7280] mt-0.5 truncate">{truncateWords(t.description, 4) || "—"}</div>
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">ASSIGNED TO</div>
                        <span className="text-[13px] text-[#374151]">{(t as any).users?.full_name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">PRIORITY</div>
                        <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">STATUS</div>
                        <Badge className={statusColor(t.status_id) || ""}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">EST. HOURS</div>
                        <span className="text-[13px] text-[#374151]">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</span>
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">DUE DATE</div>
                        <span className="text-[13px] text-[#374151]">{t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}</span>
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">FLAGGED</div>
                        {t.is_flagged ? <Badge className="bg-red-100 text-red-700">Flagged</Badge> : <span className="text-[13px] text-[#374151]">—</span>}
                      </td>
                      <td className="px-4 py-3 break-words">
                        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">VISIBLE</div>
                        {t.client_visible !== false ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3 break-words text-right flex gap-2">
                        <button onClick={() => setViewTaskData(t)} className={editButtonClass} title="View Details">
                          <Info className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEditTask(t)} className={editButtonClass} title="Edit Task">
                          <Pencil className="h-4 w-4" />
                        </button>
                        {profile?.role === "admin" && (
                          <button onClick={() => setDeleteTaskConfirmId(t.id)} className={editButtonClass} title="Delete Task">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
                </>
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
                <TableHeader gridCols="1fr 112px 192px 80px">
                  <span>PHASE</span>
                  <span>DUE DATE</span>
                  <span>PROGRESS</span>
                  <span className="text-right">ACTIONS</span>
                </TableHeader>
                {phases.map((p: any) => (
                  <DataRow key={p.id} onClick={() => openPhaseTasks(p)} gridCols="1fr 112px 192px 80px">
                    <div>
                      <RowPrimary className="whitespace-normal break-words">{p.title}</RowPrimary>
                      <RowSecondary>{(sprints || []).filter((s: any) => s.phase_id === p.id).length} sprints</RowSecondary>
                    </div>
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
                      <button onClick={(e) => { e.stopPropagation(); setConfirmPhaseDelId(p.id); }} className={editButtonClass} title="Delete Phase">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
          ) : isAdmin ? (
            <div className="space-y-6">
              {(phases || [])
                .filter((p: any) => sprints.some((s: any) => s.phase_id === p.id))
                .map((phase: any) => {
                  const phaseSprints = sprints.filter((s: any) => s.phase_id === phase.id);
                  return (
                    <div key={phase.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-sm">{phase.title}</h4>
                        <Badge variant="outline" className="text-[10px]">{phaseSprints.length} sprint{phaseSprints.length !== 1 ? "s" : ""}</Badge>
                      </div>
                      <div>
                        <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
                          <span>SPRINT</span>
                          <span>DATES</span>
                          <span>STATUS</span>
                          <span>TASKS</span>
                          <span>PROGRESS</span>
                          <span className="text-right">ACTIONS</span>
                        </TableHeader>
                        {phaseSprints.map((s: any) => (
                          <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
                            <div>
                              <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
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
                            <RowDataItem label="PROGRESS">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-muted rounded-full h-2">
                                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${sprintProgress[s.id]}%` }} />
                                </div>
                                <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                              </div>
                            </RowDataItem>
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
                    </div>
                  );
                })}
              {sprints.some((s: any) => !s.phase_id) && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Unassigned</h4>
                  <div>
                    <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
                      <span>SPRINT</span>
                      <span>DATES</span>
                      <span>STATUS</span>
                      <span>TASKS</span>
                      <span>PROGRESS</span>
                      <span className="text-right">ACTIONS</span>
                    </TableHeader>
                    {sprints.filter((s: any) => !s.phase_id).map((s: any) => (
                      <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
                        <div>
                          <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
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
                        <RowDataItem label="PROGRESS">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${sprintProgress[s.id]}%` }} />
                            </div>
                            <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                          </div>
                        </RowDataItem>
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
                </div>
              )}
            </div>
          ) : (
            <div>
              <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
                <span>SPRINT</span>
                <span>DATES</span>
                <span>STATUS</span>
                <span>TASKS</span>
                <span>PROGRESS</span>
              </TableHeader>
              {sprints.map((s: any) => (
                <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
                  <div>
                    <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
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
                  <RowDataItem label="PROGRESS">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${sprintProgress[s.id]}%` }} />
                      </div>
                      <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                    </div>
                  </RowDataItem>
                </DataRow>
              ))}
            </div>
          )}
        </TabsContent>

        {/* KANBAN BOARD — all project members */}
        <TabsContent value="kanban" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Kanban Board</h2>
            <div className="flex gap-2">
              <Select value={kanbanSprintFilter} onValueChange={setKanbanSprintFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="All Sprints" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sprints</SelectItem>
                  <SelectItem value="__backlog__">Backlog</SelectItem>
                  {sprints.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kanbanPriorityFilter} onValueChange={setKanbanPriorityFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button size="sm" onClick={() => setAddTaskOpen(true)} className="rounded-button">
                  <Plus className="h-4 w-4 mr-1" />Add Task
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "500px" }}>
            {(workflowStatuses || []).map((status: any) => {
              const tasksInColumn = (tasks || []).filter((t: any) => {
                const statusMatch = t.status === status.name;
                const sprintMatch = kanbanSprintFilter === "all"
                  || (kanbanSprintFilter === "__backlog__" ? !t.sprint_id : t.sprint_id === kanbanSprintFilter);
                const priorityMatch = kanbanPriorityFilter === "all" || t.priority === kanbanPriorityFilter;
                return statusMatch && sprintMatch && priorityMatch;
              });

              return (
                <div key={status.id} className="flex-shrink-0 w-72 bg-muted/30 rounded-lg border flex flex-col">
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${(status.color || "bg-gray-400").split(" ")[0] || "bg-gray-400"}`} />
                      <span className="font-semibold text-sm capitalize">{status.name.replace(/_/g, " ")}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{tasksInColumn.length}</Badge>
                  </div>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
                    {tasksInColumn.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                    ) : (
                      tasksInColumn.map((t: any) => (
                        <div
                          key={t.id}
                          className="bg-white rounded-md p-3 border cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setViewTaskData(t)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight line-clamp-2">{t.title}</span>
                            <Badge className={`shrink-0 ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {(t as any).users?.full_name && (
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={getAvatarUrl((t as any).users?.full_name)} />
                                <AvatarFallback className="text-[8px]">{(t as any).users?.full_name?.charAt(0) || "?"}</AvatarFallback>
                              </Avatar>
                            )}
                            {(t as any).users?.full_name && (
                              <span className="text-xs text-muted-foreground truncate">{(t as any).users?.full_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {t.due_date && (
                              <span className="text-xs text-muted-foreground">Due {format(new Date(t.due_date + "T00:00:00"), "MMM d")}</span>
                            )}
                            {t.sprint_id && (() => {
                              const s = sprints.find((sp: any) => sp.id === t.sprint_id);
                              return s ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.name}</Badge> : null;
                            })()}
                            {t.is_flagged && <Flag className="h-3 w-3 text-red-500 shrink-0" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="action-items" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Action Items</h3>
            </div>
            {actionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No action items yet.</p>
            ) : (
              <div>
                <TableHeader gridCols="1fr 80px 100px 96px 96px 80px 80px 80px 100px 80px">
                  <span>TITLE</span>
                  <span>PRIORITY</span>
                  <span>STATUS</span>
                  <span>DUE DATE</span>
                  <span>REQUESTED</span>
                  <span>VISIBLE</span>
                  <span>BLOCKER</span>
                  <span>RELATED TASK</span>
                  <span>ASSIGNED</span>
                  <span className="text-right">ACTIONS</span>
                </TableHeader>
                {actionItems.map((a: any) => {
                  const isExpanded = expandedActionItemId === a.id;
                  return (
                    <div key={a.id}>
                      <DataRow gridCols="1fr 80px 100px 96px 96px 80px 80px 80px 100px 80px">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedActionItemId(isExpanded ? null : a.id)}>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <div>
                            <RowPrimary>{a.title}</RowPrimary>
                            {a.description && <RowSecondary>{a.description}</RowSecondary>}
                          </div>
                        </div>
                        <RowBadgeItem label="PRIORITY">
                          <Badge className={PRIORITY_COLORS[a.priority] || "bg-gray-100 text-gray-800"}>{a.priority || "medium"}</Badge>
                        </RowBadgeItem>
                        <RowBadgeItem label="STATUS">
                          <Badge className={
                            a.status === "completed" ? "bg-green-100 text-green-800" :
                            a.status === "waived" ? "bg-gray-100 text-gray-800" :
                            "bg-yellow-100 text-yellow-800"
                          }>{a.status}</Badge>
                        </RowBadgeItem>
                        <RowDataItem label="DUE DATE">{a.due_date ? format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy") : "—"}</RowDataItem>
                        <RowDataItem label="REQUESTED">{a.requested_by_user?.full_name || "—"}</RowDataItem>
                        <RowBadgeItem label="VISIBLE">
                          {a.visible_to_client ? <Badge className="bg-blue-100 text-blue-800">Client</Badge> : <span className="text-muted-foreground">—</span>}
                        </RowBadgeItem>
                        <RowBadgeItem label="BLOCKER">
                          {a.blockers ? (
                            <Badge className={a.blockers.status === "resolved" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                              {a.blockers.status === "resolved" ? "Resolved" : "Active"}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </RowBadgeItem>
                        <RowDataItem label="RELATED TASK">{tasks?.find((t: any) => t.id === a.blockers?.task_id)?.title || "—"}</RowDataItem>
                        <RowDataItem label="ASSIGNED">{a.assigned_to_user?.full_name || "—"}</RowDataItem>
                        <div style={{ justifySelf: "end" }} className="flex items-center gap-1">
                          {a.status === "pending" && (
                            <button onClick={() => completeActionItem(a.id)} className={editButtonClass} title="Mark Resolved">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </button>
                          )}
                        </div>
                      </DataRow>
                      {isExpanded && (
                        <div className="bg-[#f9fafb] border-t border-[#e5e7eb] px-4 py-4 space-y-4 ml-6">
                          <div className="flex flex-wrap gap-3 text-sm">
                            <span className="text-muted-foreground">Priority: <Badge className={PRIORITY_COLORS[a.priority] || "bg-gray-100 text-gray-800"}>{a.priority || "medium"}</Badge></span>
                            {a.blockers && <span className="text-muted-foreground">Blocker: <span className="text-foreground font-medium">{a.blockers.description || a.blockers.title || "—"}</span></span>}
                            {a.blockers?.task_id && <span className="text-muted-foreground">Task: <span className="text-foreground font-medium">{tasks?.find((t: any) => t.id === a.blockers.task_id)?.title || "—"}</span></span>}
                            {a.due_date && <span className="text-muted-foreground">Due: <span className="text-foreground font-medium">{format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy")}</span></span>}
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
            )}
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="automation-rules" className="space-y-4">
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
        <DialogContent>
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
                      <Popover open={ruleDatePickerOpenIdx === idx} onOpenChange={(open) => setRuleDatePickerOpenIdx(open ? idx : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !cond.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {cond.value ? format(new Date(cond.value + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={cond.value ? new Date(cond.value + "T00:00:00") : undefined} onSelect={(d) => { updateCondition(idx, "value", d ? format(d, "yyyy-MM-dd") : ""); setRuleDatePickerOpenIdx(null); }} initialFocus />
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
                          <SelectItem value="reassign_to_stage_owner">Reassign to Stage Owner</SelectItem>
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
                  {act.type === "reassign_to_stage_owner" && (
                    <div className="space-y-2">
                      <Select value={act.params.status_id || ""} onValueChange={(v) => setActionParam(idx, "status_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Select target status" /></SelectTrigger>
                        <SelectContent>
                          {(workflowStatuses || []).map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={act.params.fallback_role_id || ""} onValueChange={(v) => setActionParam(idx, "fallback_role_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Fallback role (optional)" /></SelectTrigger>
                        <SelectContent>
                          {(projectRoles || []).map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Looks up the previous assignee who held this task at the target status. If none found, falls back to a balanced assignment from the selected role.</p>
                    </div>
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

      <AlertDialog open={bulkTaskDeleteOpen} onOpenChange={setBulkTaskDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTaskIds.size} task(s)?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected tasks and their blockers. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDeleteTasks} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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
      <Dialog open={editTaskOpen} onOpenChange={(open) => {
        if (!open) setDependencyWarning("");
        setEditTaskOpen(open);
      }}>
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

          {viewTaskData?.assigned_to === profile?.id && viewTaskData?.status_id && workflowStatuses && workflowTransitions && (
            <div className="mt-4">
              <StageOutcomeSelector
                taskId={viewTaskData.id}
                currentStatusId={viewTaskData.status_id}
                workflowStatuses={workflowStatuses}
                transitions={workflowTransitions}
                onDeclare={async (toStatusId) => {
                  const { error } = await supabase.rpc("declare_stage_outcome", {
                    p_task_id: viewTaskData.id,
                    p_to_status_id: toStatusId,
                    p_changed_by_type: "admin",
                  });
                  if (error) {
                    toast.error(`Could not move task: ${error.message}`);
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
                  <div className="mt-2" onClick={(e2) => e2.stopPropagation()}>
                    <p className="text-sm text-muted-foreground">Will be added as <span className="font-medium">{e.designation || "Member"}</span></p>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedPhase?.title}</DialogTitle></DialogHeader>
          <Tabs defaultValue="sprints">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="sprints">Sprints</TabsTrigger>
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
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${sprintProgress[s.id] || 0}%` }} />
                        </div>
                        <span className="text-[10px] text-[#6b7280]">{sprintProgress[s.id] || 0}%</span>
                      </div>
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
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Sprint Tasks Dialog */}
      <Dialog open={sprintTasksOpen} onOpenChange={setSprintTasksOpen}>
        <DialogContent>
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
                      <Badge className={statusColor(t.status_id) || ""}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
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
      <Dialog open={addSprintOpen} onOpenChange={(open) => { setAddSprintOpen(open); if (!open) { setSprintTaskIds([]); setSprintTaskSearch(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sprint</DialogTitle></DialogHeader>
          <form onSubmit={createSprint} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprint Name *</label>
              <Input value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="e.g. Sprint 1" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase</label>
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
              <Input type="date" value={sprintStartDate} onChange={(e) => setSprintStartDate(e.target.value)} required max={sprintEndDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={sprintEndDate} onChange={(e) => setSprintEndDate(e.target.value)} required min={sprintStartDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tasks {sprintTaskIds.length > 0 && `(${sprintTaskIds.length} selected)`}</label>
              {sprintTaskIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {sprintTaskIds.map((tid) => {
                    const task = (tasks || []).find((t: any) => t.id === tid);
                    return task ? (
                      <Badge key={tid} variant="secondary" className="text-xs gap-1">
                        {task.title}
                        <button type="button" onClick={() => setSprintTaskIds((prev) => prev.filter((id) => id !== tid))} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-sm font-normal text-muted-foreground">
                    <Search className="mr-2 h-4 w-4 shrink-0" />
                    Select tasks...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
                  <Command>
                    <CommandInput placeholder="Search tasks..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No tasks found.</CommandEmpty>
                      <CommandGroup>
                        {(tasks || []).map((t: any) => {
                          const isSelected = sprintTaskIds.includes(t.id);
                          const isAssignedToSprint = !!t.sprint_id;
                          const isComplete = !!(t.status_id && doneStatusIds.has(t.status_id));
                          const disabled = isAssignedToSprint || isComplete;
                          return (
                            <CommandItem
                              key={t.id}
                              disabled={disabled}
                              onSelect={() => { if (!disabled) setSprintTaskIds((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]); }}
                              className="flex items-center gap-2"
                            >
                              <Checkbox checked={isSelected} disabled={disabled} className="pointer-events-none" />
                              <span className="flex-1 truncate font-medium">{t.title}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{t.users?.full_name || "Unassigned"}</Badge>
                              <Badge className={`text-[10px] shrink-0 ${statusColor(t.status_id) || ""}`}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                              {isAssignedToSprint && <span className="text-[10px] text-amber-600 shrink-0 whitespace-nowrap">In: {sprintMap[t.sprint_id] || "Sprint"}</span>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit" className="rounded-button w-full">Create Sprint</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sprint Dialog */}
      <Dialog open={editSprintOpen} onOpenChange={(open) => { if (!open) { setEditSprintOpen(false); setEditSprintId(null); setEditSprintTaskIds([]); setSprintTaskSearch(""); } }}>
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
              <Input type="date" value={editSprintStartDate} onChange={(e) => setEditSprintStartDate(e.target.value)} required max={editSprintEndDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Input type="date" value={editSprintEndDate} onChange={(e) => setEditSprintEndDate(e.target.value)} required min={editSprintStartDate || undefined} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tasks {editSprintTaskIds.length > 0 && `(${editSprintTaskIds.length} selected)`}</label>
              {editSprintTaskIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {editSprintTaskIds.map((tid) => {
                    const task = (tasks || []).find((t: any) => t.id === tid);
                    return task ? (
                      <Badge key={tid} variant="secondary" className="text-xs gap-1">
                        {task.title}
                        <button type="button" onClick={() => setEditSprintTaskIds((prev) => prev.filter((id) => id !== tid))} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-sm font-normal text-muted-foreground">
                    <Search className="mr-2 h-4 w-4 shrink-0" />
                    Select tasks...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
                  <Command>
                    <CommandInput placeholder="Search tasks..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No tasks found.</CommandEmpty>
                      <CommandGroup>
                        {(tasks || []).map((t: any) => {
                          const isSelected = editSprintTaskIds.includes(t.id);
                          const isAssignedToOtherSprint = !!t.sprint_id && t.sprint_id !== editSprintId;
                          const isComplete = !!(t.status_id && doneStatusIds.has(t.status_id));
                          const disabled = isAssignedToOtherSprint || isComplete;
                          return (
                            <CommandItem
                              key={t.id}
                              disabled={disabled}
                              onSelect={() => { if (!disabled) setEditSprintTaskIds((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]); }}
                              className="flex items-center gap-2"
                            >
                              <Checkbox checked={isSelected} disabled={disabled} className="pointer-events-none" />
                              <span className="flex-1 truncate font-medium">{t.title}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{t.users?.full_name || "Unassigned"}</Badge>
                              <Badge className={`text-[10px] shrink-0 ${statusColor(t.status_id) || ""}`}>{getStatusDisplay(workflowStatuses || [], t.status_id).name}</Badge>
                              {isAssignedToOtherSprint && <span className="text-[10px] text-amber-600 shrink-0 whitespace-nowrap">In: {sprintMap[t.sprint_id] || "Sprint"}</span>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <AlertDialogDescription>This will also delete all sprints in this phase and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmPhaseDelId) deletePhase(confirmPhaseDelId); setConfirmPhaseDelId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          {projectSettings ? (
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
          ) : (
            <p className="text-sm text-muted-foreground py-4">Loading settings...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
