import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPKTDateString } from "@/hooks/useWorkSettings";
import { createNotification, createProjectRelatedNotifications, getAdminManagerIds } from "@/lib/notification-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { TableHeader, DataRow, RowPrimary, RowSecondary, RowDataItem } from "@/components/ui/data-row";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Download, Settings } from "lucide-react";
import { format } from "date-fns";
import { getAvatarUrl, parseCSVLine } from "@/lib/utils";

import { PROJECT_STATUS_OPTIONS as STATUS_OPTIONS, PROJECT_STATUS_COLORS as STATUS_COLORS } from "@/lib/workflow";
import { BlockerAlertModal, BlockerDetail } from "@/components/BlockerAlertModal";
import { useProjectDetailData } from "@/hooks/useProjectDetailData";
import { ProjectOverviewTab } from "@/components/project/ProjectOverviewTab";
import { ProjectTasksTab } from "@/components/project/ProjectTasksTab";
import { ProjectSprintsTab } from "@/components/project/ProjectSprintsTab";
import { ProjectKanbanTab } from "@/components/project/ProjectKanbanTab";
import { ProjectAutomationTab } from "@/components/project/ProjectAutomationTab";
import { ProjectStatsTab } from "@/components/project/ProjectStatsTab";
import { ProjectMembersSheet } from "@/components/project/sheets/ProjectMembersSheet";
import { ProjectActionItemsTab } from "@/components/project/tabs/ProjectActionItemsTab";
import { ProjectResourcesTab } from "@/components/project/tabs/ProjectResourcesTab";
import { ProjectPhasesTab } from "@/components/project/tabs/ProjectPhasesTab";
import { ProjectSkillsTab } from "@/components/project/tabs/ProjectSkillsTab";

import { TaskModals } from "@/components/project/dialogs/TaskModals";
import { AutomationRuleModal } from "@/components/project/dialogs/AutomationRuleModal";
import { PhaseModals } from "@/components/project/dialogs/PhaseModals";
import { SprintModals } from "@/components/project/dialogs/SprintModals";
import { ProjectSettingsModal } from "@/components/project/dialogs/ProjectSettingsModal";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export default function ProjectDetailPage() {
  const {
    slug,
    id,
    profile,
    queryClient,
    isAdmin,
    isClient,
    activeTab,
    setSearchParams,
    project,
    isLoading,
    members,
    resourceMembers,
    clientMembers,
    allEmployees,
    employeeProjects,
    logs,
    tasks,
    phases,
    workflowStatuses,
    doneStatusIds,
    initialStatus,
    statusColor,
    workflowTemplate,
    viewTaskData,
    setViewTaskData,
    criticalTaskIds,
    latestHealth,
    healthTrend,
    projectSettings,
    statusUpdates,
    statusUpdatesLoading,
    actionItems,
    expandedActionItemId,
    setExpandedActionItemId,
    actionItemMessages,
    portalMessages,
    automationRules,
    projectBlockers,
    sprints,
    sprintTaskCount,
    sprintProgress,
    phaseProgress,
  } = useProjectDetailData();

  const navigate = useNavigate();

  // Local UI Modal/Form states
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState<"resource" | "client">("resource");
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
  const [taskSprintId, setTaskSprintId] = useState("");

  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskEstimatedHours, setEditTaskEstimatedHours] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskClientVisible, setEditTaskClientVisible] = useState(true);
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [editTaskSprintId, setEditTaskSprintId] = useState("");

  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replaceDuplicates, setReplaceDuplicates] = useState(false);

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseDueDate, setPhaseDueDate] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [phaseTasksOpen, setPhaseTasksOpen] = useState(false);

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

  const [sprintTasksOpen, setSprintTasksOpen] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState<any>(null);

  const [automationRulesOpen, setAutomationRulesOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleStatus, setRuleStatus] = useState("draft");
  const [ruleTriggerType, setRuleTriggerType] = useState("status_change");
  const [rulePriority, setRulePriority] = useState(0);
  const [ruleAllowTriggering, setRuleAllowTriggering] = useState(false);
  const [ruleConditions, setRuleConditions] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [ruleActions, setRuleActions] = useState<{ type: string; params: Record<string, string> }[]>([]);
  const [deleteRuleConfirmId, setDeleteRuleConfirmId] = useState<string | null>(null);

  const [deleteTaskConfirmId, setDeleteTaskConfirmId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkTaskDeleteOpen, setBulkTaskDeleteOpen] = useState(false);

  const [blockerAlertOpen, setBlockerAlertOpen] = useState(false);
  const [blockerAlertTaskTitle, setBlockerAlertTaskTitle] = useState("");
  const [blockerAlertBlockers, setBlockerAlertBlockers] = useState<BlockerDetail[]>([]);
  const [blockerAlertAction, setBlockerAlertAction] = useState<"status" | "assignee" | "drag" | "log">("status");

  const [descExpanded, setDescExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newStatusUpdate, setNewStatusUpdate] = useState("");
  const [newStatusUpdateVisible, setNewStatusUpdateVisible] = useState(false);
  const [burndownScope, setBurndownScope] = useState<string>("project");

  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [kanbanSprintFilter, setKanbanSprintFilter] = useState<string>("all");
  const [kanbanPriorityFilter, setKanbanPriorityFilter] = useState<string>("all");

  // Actions & Handlers
  const changeStatus = async (newStatus: string) => {
    if (newStatus === "completed") {
      setPendingStatus(newStatus);
      setCompletionWarning(true);
      return;
    }
    await doStatusChange(newStatus);
  };

  const doStatusChange = async (newStatus: string) => {
    if (!id) return;
    setCompletionWarning(false);
    await supabase.from("projects").update({ status: newStatus, status_note: statusNote || null }).eq("id", id);
    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action: "project.status_changed",
      target_entity: "projects",
      target_id: id,
      metadata: { new_status: newStatus },
    });
    toast.success(`Status changed to ${newStatus}`);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
  };

  const saveStatusNote = async () => {
    if (!id) return;
    await supabase.from("projects").update({ status_note: statusNote || null }).eq("id", id);
    toast.success("Note saved");
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
    if (error) {
      toast.error(error.message);
      return;
    }
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

  const checkAndTriggerBlockerAlert = async (
    taskId: string,
    title: string,
    actionType: "status" | "assignee" | "drag" | "log" = "status"
  ): Promise<boolean> => {
    if (!taskId) return false;

    const { data: taskRow } = await supabase.from("tasks").select("is_flagged, title").eq("id", taskId).maybeSingle();
    const { data: openBlockers } = await supabase
      .from("task_blockers")
      .select("id, description, created_at, raised_by, status, client_visible")
      .eq("task_id", taskId)
      .eq("status", "open");

    const isTaskFlagged = taskRow?.is_flagged === true;
    const hasOpenBlockers = !!(openBlockers && openBlockers.length > 0);

    if (isTaskFlagged || hasOpenBlockers) {
      let mapped: BlockerDetail[] = [];
      if (openBlockers && openBlockers.length > 0) {
        const raiserIds = Array.from(new Set(openBlockers.map((b: any) => b.raised_by).filter(Boolean)));
        const userNameMap: Record<string, string> = {};
        if (raiserIds.length > 0) {
          const { data: usersData } = await supabase.from("users").select("id, full_name").in("id", raiserIds);
          (usersData || []).forEach((u: any) => {
            userNameMap[u.id] = u.full_name;
          });
        }
        mapped = openBlockers.map((b: any) => ({
          id: b.id,
          description: b.description,
          created_at: b.created_at,
          raised_by_name: userNameMap[b.raised_by] || "Team Member",
          status: b.status,
          client_visible: b.client_visible,
        }));
      } else {
        mapped = [
          {
            id: "flagged-task",
            description: "This task is flagged as blocked.",
            created_at: new Date().toISOString(),
            raised_by_name: "Team Member",
            status: "open",
          },
        ];
      }

      setBlockerAlertTaskTitle(title || taskRow?.title || "Task");
      setBlockerAlertBlockers(mapped);
      setBlockerAlertAction(actionType);
      setBlockerAlertOpen(true);
      return true;
    }
    return false;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !id) return;
    try {
      const { error } = await supabase.from("tasks").insert({
        project_id: id,
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
        projectId: id,
        type: "task_created",
        title: "Task Created",
        message: `${profile?.full_name || "A user"} created task "${taskTitle.trim()}" in project "${project?.name}"`,
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEditTask = (task: any) => {
    if (task.status_id && doneStatusIds.has(task.status_id)) {
      toast.error("Cannot edit a completed task");
      return;
    }
    setViewTaskData(null);
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
    if (!editTaskTitle.trim() || !editTaskId || !id) return;
    try {
      const { data: oldTask } = await supabase.from("tasks").select("assigned_to, completed_at, status_id").eq("id", editTaskId).single();

      const updates: any = {
        title: editTaskTitle.trim(),
        description: editTaskDescription.trim() || null,
        priority: editTaskPriority,
        estimated_hours: editTaskEstimatedHours ? parseFloat(editTaskEstimatedHours) : null,
        due_date: editTaskDueDate || null,
        client_visible: editTaskClientVisible,
        assigned_to: editTaskAssignedTo || null,
        sprint_id: editTaskSprintId || null,
      };

      const oldAssignedTo = oldTask?.assigned_to;
      const wasCompleted = !!oldTask?.completed_at;

      if (wasCompleted) {
        toast.error("Cannot edit a completed task");
        return;
      }

      if (oldAssignedTo !== editTaskAssignedTo) {
        const isBlocked = await checkAndTriggerBlockerAlert(editTaskId, editTaskTitle.trim(), "assignee");
        if (isBlocked) return;
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", editTaskId);
      if (error) {
        if (error.message.toLowerCase().includes("blocker")) {
          await checkAndTriggerBlockerAlert(editTaskId, editTaskTitle.trim(), "assignee");
          return;
        }
        throw error;
      }
      toast.success("Task updated");

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
          metadata: {
            title: "Task Returned",
            message: `${profile.full_name} moved task "${editTaskTitle.trim()}" back from completed in project "${project?.name}"`,
            project_id: id,
          },
          read: false,
        }));
        if (notifications.length > 0) await supabase.from("notifications").insert(notifications);
      }

      await createProjectRelatedNotifications({
        createdByUserId: profile?.id || "",
        projectId: id,
        type: "task_edited",
        title: "Task Updated",
        message: `${profile?.full_name || "A user"} updated task "${editTaskTitle.trim()}" in project "${project?.name}"`,
      });

      setEditTaskOpen(false);
      setEditTaskId(null);
      setEditTaskDueDate("");
      setEditTaskClientVisible(true);
      setEditTaskAssignedTo("");
      setViewTaskData(null);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteTask = async () => {
    if (!deleteTaskConfirmId || !id) return;
    const { data: delTask } = await supabase.from("tasks").select("status_id, title").eq("id", deleteTaskConfirmId).single();
    if (delTask?.status_id && doneStatusIds.has(delTask.status_id)) {
      toast.warning("Deleting a completed task — this will remove history");
    }
    const { error } = await supabase.from("tasks").delete().eq("id", deleteTaskConfirmId);
    if (error) {
      toast.error(error.message);
      return;
    }
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
    if (ids.length === 0 || !id) return;
    const { error } = await supabase.from("tasks").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelectedTaskIds(new Set());
    setBulkTaskDeleteOpen(false);
    toast.success(`${ids.length} task(s) deleted`);
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const parseDateFlexible = (dateStr: string): string | null => {
      const trimmed = dateStr.trim();
      if (!trimmed) return null;
      const native = Date.parse(trimmed);
      if (!isNaN(native)) return new Date(native).toISOString().split("T")[0];
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

      const rows: any[] = [];
      const employeeNameToId: Record<string, string> = {};
      (allEmployees || []).forEach((e: any) => {
        const fullName = (e.full_name || "").trim().toLowerCase();
        if (fullName) employeeNameToId[fullName] = e.user_id || e.id;
      });

      const existingTaskTitles = new Map((tasks || []).map((t: any) => [t.title.trim().toLowerCase(), t]));

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = cols[titleIdx]?.trim() || "";
        const description = descIdx !== -1 ? cols[descIdx]?.trim() || "" : "";
        let priority = prioIdx !== -1 ? cols[prioIdx]?.trim().toLowerCase() || "" : "";
        const estimated_hours = estIdx !== -1 ? cols[estIdx]?.trim() || "" : "";
        const due_date = dueDateIdx !== -1 ? cols[dueDateIdx]?.trim() || "" : "";
        const client_visible = clientVisIdx !== -1 ? cols[clientVisIdx]?.trim().toLowerCase() || "" : "";
        const assigned_to = assignedToIdx !== -1 ? cols[assignedToIdx]?.trim() || "" : "";
        const errors: string[] = [];

        if (!title) errors.push("Title is required");
        if (!priority) priority = "medium";
        if (estimated_hours && isNaN(Number(estimated_hours))) errors.push("Invalid estimated_hours");

        const parsedDueDate = parseDateFlexible(due_date);
        const resolvedId = assigned_to ? employeeNameToId[assigned_to.trim().toLowerCase()] || null : null;
        if (assigned_to && !resolvedId) errors.push(`Employee "${assigned_to}" not found`);

        const isDuplicate = title ? existingTaskTitles.has(title.trim().toLowerCase()) : false;
        const existingTask = isDuplicate ? existingTaskTitles.get(title.trim().toLowerCase()) : null;

        rows.push({
          rowNum: i,
          title,
          description,
          priority,
          estimated_hours,
          due_date: parsedDueDate || due_date,
          client_visible,
          assigned_to,
          resolvedId,
          isDuplicate,
          existingTaskId: existingTask?.id || null,
          errors,
        });
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkUpload = async () => {
    const validRows = csvRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0 || !id) {
      toast.error("No valid rows to upload");
      return;
    }
    setUploading(true);
    try {
      const inserts = validRows
        .filter((r) => !r.isDuplicate)
        .map((r) => ({
          project_id: id,
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
      toast.success(`${inserts.length} task(s) added`);
      setBulkTaskOpen(false);
      setCsvRows([]);
      setCsvFileName("");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreatePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseTitle.trim() || !id) return;
    try {
      const { error } = await supabase.from("project_phases").insert({
        project_id: id,
        title: phaseTitle.trim(),
        due_date: phaseDueDate || null,
      });
      if (error) throw error;
      toast.success("Phase created");
      setAddPhaseOpen(false);
      setPhaseTitle("");
      setPhaseDueDate("");
      queryClient.invalidateQueries({ queryKey: ["project-phases", id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const createSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !sprintStartDate || !sprintEndDate || !id) return;
    const { data: newSprint, error } = await supabase
      .from("sprints")
      .insert({
        project_id: id,
        phase_id: sprintPhaseId || null,
        name: sprintName.trim(),
        start_date: sprintStartDate,
        end_date: sprintEndDate,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    if (sprintTaskIds.length > 0 && newSprint) {
      await supabase.from("tasks").update({ sprint_id: newSprint.id }).in("id", sprintTaskIds);
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
    setEditSprintPhaseId(sprint.phase_id || "");
    setEditSprintTaskIds((tasks || []).filter((t: any) => t.sprint_id === sprint.id).map((t: any) => t.id));
    setEditSprintOpen(true);
  };

  const handleEditSprintSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSprintName.trim() || !editSprintStartDate || !editSprintEndDate || !editSprintId || !id) return;
    const updates: any = {
      name: editSprintName.trim(),
      start_date: editSprintStartDate,
      end_date: editSprintEndDate,
      phase_id: editSprintPhaseId || null,
    };
    if (editSprintStatus) updates.status = editSprintStatus;

    const { error } = await supabase.from("sprints").update(updates).eq("id", editSprintId);
    if (error) {
      toast.error(error.message);
      return;
    }

    const previouslyAssigned = (tasks || []).filter((t: any) => t.sprint_id === editSprintId);
    const toUnassign = previouslyAssigned.filter((t: any) => !editSprintTaskIds.includes(t.id));
    const toUnassignIds = toUnassign.map((t: any) => t.id);
    if (toUnassignIds.length > 0) {
      const { error: unassignErr } = await supabase.from("tasks").update({
        sprint_id: null,
      }).in("id", toUnassignIds);
      if (unassignErr) { toast.error(unassignErr.message); return; }
    }
    if (editSprintTaskIds.length > 0) {
      const assignTasks = (tasks || []).filter((t: any) => editSprintTaskIds.includes(t.id));
      const finalAssignTasks = editSprintStatus === 'completed' 
        ? assignTasks.filter((t: any) => doneStatusIds.has(t.status_id) || t.status === 'complete')
        : assignTasks;

      if (finalAssignTasks.length > 0) {
        const { error: assignErr } = await supabase.from("tasks").update({
          sprint_id: editSprintId,
        }).in("id", finalAssignTasks.map((t: any) => t.id));
        if (assignErr) { toast.error(assignErr.message); return; }
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
    if (!confirm("Delete this sprint? Tasks will be unassigned from it.") || !id) return;
    const { error } = await supabase.from("sprints").delete().eq("id", sprintId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sprint deleted");
    queryClient.invalidateQueries({ queryKey: ["project-sprints", id] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  const openSprintTasks = (sprint: any) => {
    setSelectedSprint(sprint);
    setSprintTasksOpen(true);
  };

  const openPhaseTasks = (phase: any) => {
    setSelectedPhase(phase);
    setPhaseTasksOpen(true);
  };

  const saveAutomationRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleDescription.trim() || !id || !profile) {
      toast.error("Name and description are required");
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
      const { error } = await supabase.from("automation_rules").update(payload).eq("id", editRuleId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Automation rule updated");
    } else {
      const { error } = await supabase.from("automation_rules").insert({
        ...payload,
        project_id: id,
        created_by: profile.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Automation rule created");
    }
    setAutomationRulesOpen(false);
    queryClient.invalidateQueries({ queryKey: ["project-automation-rules", id] });
  };

  const toggleRuleStatus = async (ruleId: string, enabled: boolean) => {
    if (!id) return;
    const { error } = await supabase
      .from("automation_rules")
      .update({ status: enabled ? "enabled" : "disabled" })
      .eq("id", ruleId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["project-automation-rules", id] });
  };

  const deleteAutomationRule = async () => {
    if (!deleteRuleConfirmId || !id) return;
    const { error } = await supabase.from("automation_rules").delete().eq("id", deleteRuleConfirmId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteRuleConfirmId(null);
    toast.success("Automation rule deleted");
    queryClient.invalidateQueries({ queryKey: ["project-automation-rules", id] });
  };

  const saveProjectSettings = async (vals: any) => {
    if (!id) return;
    try {
      const { error } = await supabase.from("project_settings").update(vals).eq("project_id", id);
      if (error) throw error;
      toast.success("Project settings saved");
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-settings", id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const exportCSV = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatHours = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const CHART_COLORS = ["hsl(82,100%,72%)", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];

  const hoursByMember = Object.values(
    (logs || []).reduce((acc: Record<string, { name: string; hours: number }>, l: any) => {
      const name = (l.users as any)?.full_name || "Unknown";
      acc[name] = acc[name] || { name, hours: 0 };
      acc[name].hours += Number(l.hours);
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.hours - a.hours);

  const categoryBreakdown = Object.values(
    (logs || []).reduce((acc: Record<string, { name: string; value: number }>, l: any) => {
      acc[l.category] = acc[l.category] || { name: l.category, value: 0 };
      acc[l.category].value += Number(l.hours);
      return acc;
    }, {})
  );

  const weeklyLogs = Object.entries(
    (logs || []).reduce((acc: Record<string, number>, l: any) => {
      const week = format(new Date(l.log_date), "yyyy-'W'II");
      acc[week] = (acc[week] || 0) + Number(l.hours);
      return acc;
    }, {})
  ).sort().map(([week, hours]) => ({ week, hours }));

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (!project) return <div className="text-center py-12 text-muted-foreground">Project not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/projects");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
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
            <TabsTrigger value="skills">Skills & Matching</TabsTrigger>
            <TabsTrigger value="resources">Resources ({resourceMembers.length})</TabsTrigger>
            <TabsTrigger value="clients">Client's Member ({clientMembers.length})</TabsTrigger>
            {isAdmin && <TabsTrigger value="logs">Logs</TabsTrigger>}
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks ({isAdmin ? tasks?.length || 0 : (tasks || []).filter((t: any) => t.assigned_to === profile?.id || t.created_by === profile?.id).length})
            </TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            {isAdmin && <TabsTrigger value="phases">Phases</TabsTrigger>}
            <TabsTrigger value="sprints">Sprints ({sprints?.length || 0})</TabsTrigger>
            {!isClient && (
              <TabsTrigger value="action-items">
                Action Items ({isAdmin ? actionItems.length : actionItems.filter((a: any) => a.assigned_to === profile?.id || a.requested_by === profile?.id).length})
              </TabsTrigger>
            )}
            {isAdmin && <TabsTrigger value="automation-rules">Automation ({automationRules.length})</TabsTrigger>}
          </TabsList>
        )}

        <TabsContent value="overview">
          <ProjectOverviewTab
            project={project}
            latestHealth={latestHealth}
            workflowTemplate={workflowTemplate}
            isAdmin={isAdmin}
            isClient={isClient}
            STATUS_OPTIONS={STATUS_OPTIONS}
            changeStatus={changeStatus}
            statusNote={statusNote}
            setStatusNote={setStatusNote}
            saveStatusNote={saveStatusNote}
            portalMessages={portalMessages}
            burndownScope={burndownScope}
            setBurndownScope={setBurndownScope}
            phases={phases}
            tasks={tasks}
            sprints={sprints}
            logs={logs}
            statusUpdatesLoading={statusUpdatesLoading}
            statusUpdates={statusUpdates}
            getAvatarUrl={getAvatarUrl}
            newStatusUpdate={newStatusUpdate}
            setNewStatusUpdate={setNewStatusUpdate}
            newStatusUpdateVisible={newStatusUpdateVisible}
            setNewStatusUpdateVisible={setNewStatusUpdateVisible}
            addStatusUpdate={addStatusUpdate}
          />
        </TabsContent>

        <TabsContent value="resources">
          <ProjectResourcesTab
            id={id!}
            type="resource"
            members={resourceMembers}
            isAdmin={isAdmin}
            profile={profile}
            queryClient={queryClient}
            setAddMemberMode={setAddMemberMode}
            setAddMemberOpen={setAddMemberOpen}
          />
        </TabsContent>

        <TabsContent value="skills">
          <ProjectSkillsTab
            projectId={project.id}
            projectName={project.name}
            isAdmin={isAdmin}
            onAssignCandidate={async (candidateUserId) => {
              const emp = (allEmployees || []).find((e: any) => e.id === candidateUserId);
              const roleName = emp?.designation || "Member";
              let roleId: string | null = null;
              const { data: existingRole } = await supabase
                .from("project_roles")
                .select("id")
                .eq("project_id", project.id)
                .eq("name", roleName)
                .maybeSingle();

              if (existingRole) {
                roleId = existingRole.id;
              } else {
                const { data: newRole } = await supabase
                  .from("project_roles")
                  .insert({ project_id: project.id, name: roleName })
                  .select("id")
                  .single();
                roleId = newRole?.id || null;
              }

              const { data: existingMember } = await supabase
                .from("project_members")
                .select("id, removed_at")
                .eq("project_id", project.id)
                .eq("user_id", candidateUserId)
                .maybeSingle();

              if (existingMember) {
                if (existingMember.removed_at) {
                  await supabase
                    .from("project_members")
                    .update({ removed_at: null, project_role_id: roleId } as any)
                    .eq("id", existingMember.id);
                } else {
                  toast.info(`${emp?.full_name || "Employee"} is already assigned to this project.`);
                  return;
                }
              } else {
                await supabase.from("project_members").insert({
                  project_id: project.id,
                  user_id: candidateUserId,
                  project_role_id: roleId,
                });
              }

              await supabase.from("audit_logs").insert({
                actor_id: profile?.id,
                action: "project.member_added",
                target_entity: "project_members",
                target_id: project.id,
                metadata: { user_id: candidateUserId },
              });

              toast.success(`${emp?.full_name || "Candidate"} assigned to project successfully!`);
              queryClient.invalidateQueries({ queryKey: ["project-members", project.id] });
              queryClient.invalidateQueries({ queryKey: ["resource-recommendations"] });
            }}
          />
        </TabsContent>

        <TabsContent value="clients">
          <ProjectResourcesTab
            id={id!}
            type="client"
            members={clientMembers}
            isAdmin={isAdmin}
            profile={profile}
            queryClient={queryClient}
            setAddMemberMode={setAddMemberMode}
            setAddMemberOpen={setAddMemberOpen}
          />
        </TabsContent>

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
                      {(logs || []).filter((l) => !logFilterDate || l.log_date === logFilterDate).length} logs found
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      (logs || [])
                        .filter((l) => !logFilterDate || l.log_date === logFilterDate)
                        .map((l) => ({
                          Date: l.log_date,
                          Employee: (l.users as any)?.full_name,
                          Category: l.category,
                          Hours: l.hours,
                          Description: l.description,
                        })),
                      `${project.name}-logs-${logFilterDate || "all"}.csv`
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>

              <div>
                {(() => {
                  const filtered = (logs || []).filter((l) => !logFilterDate || l.log_date === logFilterDate);
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

        <TabsContent value="stats" className="space-y-6">
          <ProjectStatsTab
            latestHealth={latestHealth}
            logs={logs}
            tasks={tasks}
            project={project}
            workflowStatuses={workflowStatuses}
            healthTrend={healthTrend}
            projectBlockers={projectBlockers}
            phases={phases}
            sprints={sprints}
            burndownScope={burndownScope}
            setBurndownScope={setBurndownScope}
            isAdmin={isAdmin}
            hoursByMember={hoursByMember}
            categoryBreakdown={categoryBreakdown}
            weeklyLogs={weeklyLogs}
            CHART_COLORS={CHART_COLORS}
            PRIORITY_COLORS={PRIORITY_COLORS}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <ProjectTasksTab
            tasks={tasks}
            sprints={sprints}
            phases={phases}
            isAdmin={isAdmin}
            viewTaskData={viewTaskData}
            setViewTaskData={setViewTaskData}
            PRIORITY_COLORS={PRIORITY_COLORS}
            taskStatusFilter={taskStatusFilter}
            setTaskStatusFilter={setTaskStatusFilter}
            workflowStatuses={workflowStatuses}
            setBulkTaskOpen={setBulkTaskOpen}
            setAddTaskOpen={setAddTaskOpen}
            profile={profile}
            selectedTaskIds={selectedTaskIds}
            setSelectedTaskIds={setSelectedTaskIds}
            setBulkTaskDeleteOpen={setBulkTaskDeleteOpen}
            criticalTaskIds={criticalTaskIds}
            openEditTask={openEditTask}
            setDeleteTaskConfirmId={setDeleteTaskConfirmId}
            isClient={isClient}
            doneStatusIds={doneStatusIds}
            statusColor={statusColor}
          />
        </TabsContent>

        <TabsContent value="kanban" className="space-y-4">
          <ProjectKanbanTab
            tasks={tasks}
            sprints={sprints}
            workflowStatuses={workflowStatuses}
            isAdmin={isAdmin}
            setViewTaskData={setViewTaskData}
            PRIORITY_COLORS={PRIORITY_COLORS}
            setAddTaskOpen={setAddTaskOpen}
            kanbanSprintFilter={kanbanSprintFilter}
            setKanbanSprintFilter={setKanbanSprintFilter}
            kanbanPriorityFilter={kanbanPriorityFilter}
            setKanbanPriorityFilter={setKanbanPriorityFilter}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="phases">
            <ProjectPhasesTab
              id={id!}
              slug={slug}
              phases={phases}
              sprints={sprints}
              phaseProgress={phaseProgress}
              isAdmin={isAdmin}
              setAddPhaseOpen={setAddPhaseOpen}
              openPhaseTasks={openPhaseTasks}
              queryClient={queryClient}
            />
          </TabsContent>
        )}

        <TabsContent value="sprints" className="space-y-4">
          <ProjectSprintsTab
            phases={phases}
            sprints={sprints}
            tasks={tasks}
            isAdmin={isAdmin}
            sprintTaskCount={sprintTaskCount}
            sprintProgress={sprintProgress}
            openEditSprint={openEditSprint}
            deleteSprint={deleteSprint}
            openSprintTasks={openSprintTasks}
            setAddSprintOpen={setAddSprintOpen}
          />
        </TabsContent>

        {!isClient && (
          <TabsContent value="action-items" className="space-y-4">
            <ProjectActionItemsTab
              id={id!}
              actionItems={actionItems}
              tasks={tasks}
              profile={profile}
              isAdmin={isAdmin}
              isClient={isClient}
              queryClient={queryClient}
              expandedActionItemId={expandedActionItemId}
              setExpandedActionItemId={setExpandedActionItemId}
              actionItemMessages={actionItemMessages}
              PRIORITY_COLORS={PRIORITY_COLORS}
              project={project}
            />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="automation-rules" className="space-y-4">
            <ProjectAutomationTab
              automationRules={automationRules}
              openAddRule={() => setAutomationRulesOpen(true)}
              openEditRule={(rule) => {
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
              }}
              toggleRuleStatus={toggleRuleStatus}
              setDeleteRuleConfirmId={setDeleteRuleConfirmId}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Sheets & Dialogs */}
      <ProjectMembersSheet
        id={id!}
        addMemberOpen={addMemberOpen}
        setAddMemberOpen={setAddMemberOpen}
        addMemberMode={addMemberMode}
        allEmployees={allEmployees}
        members={members}
        employeeProjects={employeeProjects}
        profile={profile}
        queryClient={queryClient}
      />

      <AutomationRuleModal
        automationRulesOpen={automationRulesOpen}
        setAutomationRulesOpen={setAutomationRulesOpen}
        editRuleId={editRuleId}
        ruleName={ruleName}
        setRuleName={setRuleName}
        ruleDescription={ruleDescription}
        setRuleDescription={setRuleDescription}
        ruleStatus={ruleStatus}
        setRuleStatus={setRuleStatus}
        ruleTriggerType={ruleTriggerType}
        setRuleTriggerType={setRuleTriggerType}
        rulePriority={rulePriority}
        setRulePriority={setRulePriority}
        ruleAllowTriggering={ruleAllowTriggering}
        setRuleAllowTriggering={setRuleAllowTriggering}
        ruleConditions={ruleConditions}
        setRuleConditions={setRuleConditions}
        ruleActions={ruleActions}
        setRuleActions={setRuleActions}
        saveAutomationRule={saveAutomationRule}
        resetRuleForm={() => {
          setEditRuleId(null);
          setRuleName("");
          setRuleDescription("");
          setRuleStatus("draft");
          setRuleTriggerType("status_change");
          setRulePriority(0);
          setRuleAllowTriggering(false);
          setRuleConditions([]);
          setRuleActions([]);
        }}
        workflowStatuses={workflowStatuses}
        members={members}
      />

      <AlertDialog open={!!deleteRuleConfirmId} onOpenChange={(o) => !o && setDeleteRuleConfirmId(null)}>
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

      <AlertDialog open={!!deleteTaskConfirmId} onOpenChange={(o) => !o && setDeleteTaskConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this task and its blockers. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTaskConfirmId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
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
            <AlertDialogAction onClick={bulkDeleteTasks} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskModals
        addTaskOpen={addTaskOpen}
        setAddTaskOpen={setAddTaskOpen}
        bulkTaskOpen={bulkTaskOpen}
        setBulkTaskOpen={setBulkTaskOpen}
        editTaskOpen={editTaskOpen}
        setEditTaskOpen={setEditTaskOpen}
        viewTaskData={viewTaskData}
        setViewTaskData={setViewTaskData}
        taskTitle={taskTitle}
        setTaskTitle={setTaskTitle}
        taskDescription={taskDescription}
        setTaskDescription={setTaskDescription}
        taskPriority={taskPriority}
        setTaskPriority={setTaskPriority}
        taskAssignedTo={taskAssignedTo}
        setTaskAssignedTo={setTaskAssignedTo}
        taskSprintId={taskSprintId}
        setTaskSprintId={setTaskSprintId}
        taskEstimatedHours={taskEstimatedHours}
        setTaskEstimatedHours={setTaskEstimatedHours}
        taskDueDate={taskDueDate}
        setTaskPlannedStartDate={setTaskDueDate}
        taskClientVisible={taskClientVisible}
        setTaskClientVisible={setTaskClientVisible}
        editTaskTitle={editTaskTitle}
        setEditTaskTitle={setEditTaskTitle}
        editTaskDescription={editTaskDescription}
        setEditTaskDescription={setEditTaskDescription}
        editTaskPriority={editTaskPriority}
        setEditTaskPriority={setEditTaskPriority}
        editTaskAssignedTo={editTaskAssignedTo}
        setEditTaskAssignedTo={setEditTaskAssignedTo}
        editTaskSprintId={editTaskSprintId}
        setEditTaskSprintId={setEditTaskSprintId}
        editTaskEstimatedHours={editTaskEstimatedHours}
        setEditTaskEstimatedHours={setEditTaskEstimatedHours}
        editTaskDueDate={editTaskDueDate}
        setEditTaskPlannedStartDate={setEditTaskDueDate}
        editTaskClientVisible={editTaskClientVisible}
        setEditTaskClientVisible={setEditTaskClientVisible}
        descExpanded={descExpanded}
        setDescExpanded={setDescExpanded}
        csvRows={csvRows}
        setCsvRows={setCsvRows}
        csvFileName={csvFileName}
        setCsvFileName={setCsvFileName}
        uploading={uploading}
        setUploading={setUploading}
        replaceDuplicates={replaceDuplicates}
        setReplaceDuplicates={setReplaceDuplicates}
        handleCreateTask={handleCreateTask}
        handleEditTaskSave={handleEditTaskSave}
        handleBulkUpload={handleBulkUpload}
        handleCSVUpload={handleCSVUpload}
        openEditTask={openEditTask}
        members={members}
        sprints={sprints}
        phases={phases}
        workflowStatuses={workflowStatuses}
        profile={profile}
        isAdmin={isAdmin}
        isClient={isClient}
        PRIORITY_COLORS={PRIORITY_COLORS}
        doneStatusIds={doneStatusIds}
      />

      <PhaseModals
        addPhaseOpen={addPhaseOpen}
        setAddPhaseOpen={setAddPhaseOpen}
        phaseTasksOpen={phaseTasksOpen}
        setPhaseTasksOpen={setPhaseTasksOpen}
        selectedPhase={selectedPhase}
        phaseTitle={phaseTitle}
        setPhaseTitle={setPhaseTitle}
        phaseDueDate={phaseDueDate}
        setPhaseDueDate={setPhaseDueDate}
        handleCreatePhase={handleCreatePhase}
        tasks={tasks}
        sprints={sprints}
        openEditTask={openEditTask}
        setViewTaskData={setViewTaskData}
        PRIORITY_COLORS={PRIORITY_COLORS}
      />

      <SprintModals
        addSprintOpen={addSprintOpen}
        setAddSprintOpen={setAddSprintOpen}
        editSprintOpen={editSprintOpen}
        setEditSprintOpen={setEditSprintOpen}
        sprintTasksOpen={sprintTasksOpen}
        setSprintTasksOpen={setSprintTasksOpen}
        selectedSprint={selectedSprint}
        sprintName={sprintName}
        setSprintName={setSprintName}
        sprintStartDate={sprintStartDate}
        setSprintStartDate={setSprintStartDate}
        sprintEndDate={sprintEndDate}
        setSprintEndDate={setSprintEndDate}
        sprintPhaseId={sprintPhaseId}
        setSprintPhaseId={setSprintPhaseId}
        sprintTaskIds={sprintTaskIds}
        setSprintTaskIds={setSprintTaskIds}
        sprintTaskSearch={sprintTaskSearch}
        setSprintTaskSearch={setSprintTaskSearch}
        editSprintId={editSprintId}
        setEditSprintId={setEditSprintId}
        editSprintName={editSprintName}
        setEditSprintName={setEditSprintName}
        editSprintStartDate={editSprintStartDate}
        setEditSprintStartDate={setEditSprintStartDate}
        editSprintEndDate={editSprintEndDate}
        setEditSprintEndDate={setEditSprintEndDate}
        editSprintStatus={editSprintStatus}
        setEditSprintStatus={setEditSprintStatus}
        editSprintPhaseId={editSprintPhaseId}
        setEditSprintPhaseId={setEditSprintPhaseId}
        editSprintTaskIds={editSprintTaskIds}
        setEditSprintTaskIds={setEditSprintTaskIds}
        createSprint={createSprint}
        handleEditSprintSave={handleEditSprintSave}
        tasks={tasks}
        phases={phases}
        openEditTask={openEditTask}
        setViewTaskData={setViewTaskData}
        PRIORITY_COLORS={PRIORITY_COLORS}
        sprintTaskCount={sprintTaskCount}
        workflowStatuses={workflowStatuses}
        doneStatusIds={doneStatusIds}
      />

      <ProjectSettingsModal
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        projectSettings={projectSettings}
        saveProjectSettings={saveProjectSettings}
      />

      <AlertDialog open={completionWarning} onOpenChange={setCompletionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Project as Completed?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the project status to completed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompletionWarning(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => doStatusChange(pendingStatus)}>
              Mark Completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BlockerAlertModal
        isOpen={blockerAlertOpen}
        onClose={() => setBlockerAlertOpen(false)}
        taskTitle={blockerAlertTaskTitle}
        blockers={blockerAlertBlockers}
        actionAttempted={blockerAlertAction}
      />
    </div>
  );
}
