import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toSlug } from "@/lib/utils";
import { getStatusColor, getDoneStatusIds, getInitialStatus } from "@/lib/workflow";

export function useProjectDetailData() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isClient = profile?.role === "client" || profile?.role === "client member";

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const [viewTaskData, setViewTaskData] = useState<any>(null);
  const [expandedActionItemId, setExpandedActionItemId] = useState<string | null>(null);

  // 1. Resolve project slug to project ID
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

  // 2. Project metadata
  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // 3. Project members
  const { data: members } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const [membersResult, logsResult] = await Promise.all([
        supabase
          .from("project_members")
          .select("*, users(id, full_name, designation, avatar_url, role), project_roles(name)")
          .eq("project_id", id!)
          .is("removed_at", null),
        supabase
          .from("daily_logs")
          .select("user_id, hours")
          .eq("project_id", id!)
          .eq("status", "submitted"),
      ]);
      const membersData = membersResult.data || [];
      const logsData = logsResult.data || [];
      const hoursByUser: Record<string, number> = {};
      logsData.forEach((l: any) => {
        hoursByUser[l.user_id] = (hoursByUser[l.user_id] || 0) + Number(l.hours || 0);
      });
      return membersData.map((m: any) => ({ ...m, _hoursSpent: hoursByUser[m.user_id] || 0 }));
    },
    enabled: !!id,
  });

  const resourceMembers = useMemo(
    () => (members || []).filter((m: any) => !["Client", "Client Member"].includes((m.users as any)?.designation)),
    [members]
  );
  const clientMembers = useMemo(
    () => (members || []).filter((m: any) => ["Client", "Client Member"].includes((m.users as any)?.designation)),
    [members]
  );

  // 4. All Employees (for admin assignment)
  const { data: allEmployees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, designation")
        .eq("status", "active")
        .neq("role", "admin")
        .order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  // 5. Employee active projects map
  const { data: employeeProjects } = useQuery({
    queryKey: ["employee-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("user_id, projects(name)")
        .is("removed_at", null);
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

  // 6. Daily logs
  const { data: logs } = useQuery({
    queryKey: ["project-logs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, users(full_name)")
        .eq("project_id", id!)
        .eq("status", "submitted")
        .order("log_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // 7. Project tasks
  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data: rawTasks } = await supabase
        .from("tasks")
        .select("*, users:assigned_to(full_name), blockers:task_blockers(id, status)")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });

      if (!rawTasks) return [];

      return rawTasks.map((t: any) => {
        const hasOpenBlocker = (t.blockers || []).some((b: any) => b.status === "open");
        return {
          ...t,
          is_flagged: t.is_flagged || hasOpenBlocker,
        };
      });
    },
    enabled: !!id,
    refetchInterval: 3000,
  });

  // 8. Project phases
  const { data: phases = [] } = useQuery({
    queryKey: ["project-phases", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_phases")
        .select("*")
        .eq("project_id", id!)
        .order("sort_order", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  // 9. Workflow statuses & transitions
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

  const { data: currentUserProjectRoleId } = useQuery({
    queryKey: ["current-user-project-role", id, profile?.id],
    queryFn: async () => {
      if (!profile?.id || !id) return null;
      const { data } = await supabase
        .from("project_members")
        .select("project_role_id")
        .eq("project_id", id)
        .eq("user_id", profile.id)
        .is("removed_at", null)
        .maybeSingle();
      return data?.project_role_id ?? null;
    },
    enabled: !!id && !!profile?.id,
  });

  // 10. Active task view queries
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
    refetchInterval: 3000,
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

  // 11. Schedule snapshots / Critical path
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

  // 12. Roles, health & settings
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

  // 13. Status updates
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

  // 14. Action items & messaging
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
    refetchInterval: 3000,
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
    refetchInterval: 3000,
  });

  // 15. Sprints & memoized summaries
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
  }, [sprints, tasks, doneStatusIds]);

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

  // Real-time subscriptions
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

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-realtime-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_blockers", filter: `project_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
          queryClient.invalidateQueries({ queryKey: ["project-blockers", id] });
          queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });
          if (viewTaskData?.id) {
            queryClient.invalidateQueries({ queryKey: ["task-blockers-view", viewTaskData.id] });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
          if (viewTaskData?.id) {
            queryClient.invalidateQueries({ queryKey: ["task-blockers-view", viewTaskData.id] });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_action_items", filter: `project_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, viewTaskData?.id, queryClient]);

  return {
    slug,
    id,
    navigate,
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
    workflowTransitions,
    workflowTemplate,
    currentUserProjectRoleId,
    viewTaskData,
    setViewTaskData,
    viewComments,
    viewCommentsLoading,
    viewBlockers,
    viewBlockersLoading,
    viewDeps,
    viewDepsLoading,
    scheduleSnapshots,
    criticalTaskIds,
    projectRoles,
    latestHealth,
    healthTrend,
    projectSettings,
    statusUpdates,
    statusUpdatesLoading,
    actionItems,
    expandedActionItemId,
    setExpandedActionItemId,
    actionItemMessages,
    eligibleBlockers,
    portalMessages,
    automationRules,
    projectBlockers,
    sprints,
    sprintTaskCount,
    sprintMap,
    sprintProgress,
    phaseProgress,
  };
}
