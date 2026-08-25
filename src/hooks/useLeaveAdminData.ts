import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { getPKTDateString } from "@/hooks/useWorkSettings";
import { getLeaveTypeName, getCurrentLeaveYear, getLeaveYearRange } from "@/lib/utils";

export const LEAVE_CATEGORIES = ["Sick Leave", "Casual Leave", "Hourly Leave", "Others"];

export function useLeaveAdminData() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [actionModal, setActionModal] = useState<{ type: "approve" | "reject"; request: any } | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [wfhDeleteId, setWfhDeleteId] = useState<string | null>(null);
  const [wfhDeleting, setWfhDeleting] = useState(false);
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<Set<string>>(new Set());
  const [bulkDeleteLeaveOpen, setBulkDeleteLeaveOpen] = useState(false);
  const [selectedWfhIds, setSelectedWfhIds] = useState<Set<string>>(new Set());
  const [bulkDeleteWfhOpen, setBulkDeleteWfhOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [wfhStatusFilter, setWfhStatusFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [submittedDate, setSubmittedDate] = useState("");
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentLeaveYear().startYear);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [namesModal, setNamesModal] = useState<{ date: string; leaves: any[] } | null>(null);

  // Annual leave entitlement setting
  const [annualEntitlement, setAnnualEntitlement] = useState("12");
  const [savingEntitlement, setSavingEntitlement] = useState(false);

  // Bulk remote access
  const [bulkRemoteFrom, setBulkRemoteFrom] = useState("");
  const [bulkRemoteTo, setBulkRemoteTo] = useState("");
  const [bulkRemoteSubmitting, setBulkRemoteSubmitting] = useState(false);
  const [showBulkEnableConfirm, setShowBulkEnableConfirm] = useState(false);
  const [showBulkDisableConfirm, setShowBulkDisableConfirm] = useState(false);

  // 1. Fetch system settings
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  useEffect(() => {
    if (settings?.annual_leave_entitlement) {
      setAnnualEntitlement(settings.annual_leave_entitlement);
    }
  }, [settings]);

  const handleSaveEntitlement = async () => {
    setSavingEntitlement(true);
    try {
      await supabase.from("system_settings").upsert(
        { key: "annual_leave_entitlement", value: annualEntitlement, updated_by: profile?.id },
        { onConflict: "key" }
      );
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.leave_entitlement_updated",
        target_entity: "system_settings",
        metadata: { annual_leave_entitlement: annualEntitlement },
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Annual leave entitlement updated");
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingEntitlement(false); }
  };

  const handleBulkEnable = async () => {
    if (!bulkRemoteFrom) { toast.error("Please select From date"); return; }
    const to = bulkRemoteTo || bulkRemoteFrom;
    setBulkRemoteSubmitting(true);
    try {
      const { error } = await supabase.from("users")
        .update({
          remote_access: true,
          remote_access_from: bulkRemoteFrom,
          remote_access_to: to,
          remote_access_bulk: true,
        } as any)
        .neq("role", "admin")
        .not("remote_access", "is", true);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "remote_access.bulk_enabled",
        target_entity: "users",
        metadata: { from: bulkRemoteFrom, to },
      });
      toast.success("Remote access enabled for all non-admin users");
      setShowBulkEnableConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["admin-all-employees"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setBulkRemoteSubmitting(false); }
  };

  const handleBulkDisable = async () => {
    setBulkRemoteSubmitting(true);
    try {
      const { error } = await supabase.from("users")
        .update({
          remote_access: false,
          remote_access_from: null,
          remote_access_to: null,
          remote_access_bulk: null,
        } as any)
        .neq("role", "admin")
        .eq("remote_access_bulk", true);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "remote_access.bulk_disabled",
        target_entity: "users",
      });
      toast.success("Bulk remote access disabled for all non-admin users");
      setShowBulkDisableConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["admin-all-employees"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setBulkRemoteSubmitting(false); }
  };

  // 2. Fetch leave requests
  const { data: requests = [] } = useQuery({
    queryKey: ["admin-leave-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests")
        .select("*, leave_types(name), users!leave_requests_user_id_fkey(full_name, department, email, is_oversight)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const yearRange = getLeaveYearRange(selectedYear);
    return requests.filter((r: any) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchYear = r.start_date >= yearRange.start && r.start_date <= yearRange.end;
      const typeName = getLeaveTypeName(r);
      const matchLeaveType = leaveTypeFilter === "all" || typeName.startsWith(leaveTypeFilter);
      const matchSubmitted = !submittedDate || (r.created_at && r.created_at.startsWith(submittedDate));
      return matchStatus && matchYear && matchLeaveType && matchSubmitted;
    });
  }, [requests, statusFilter, selectedYear, leaveTypeFilter, submittedDate]);

  // 3. Fetch remote work requests
  const { data: wfhRequests = [] } = useQuery({
    queryKey: ["admin-wfh-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("remote_work_requests")
        .select("*, users!remote_work_requests_user_id_fkey(full_name, designation, is_oversight), reviewer:users!remote_work_requests_reviewed_by_fkey(full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // 4. Fetch leave types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("*").order("name");
      return data || [];
    },
  });

  // 5. Fetch all active non-admin employees
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["admin-all-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("status", "active")
        .neq("role", "admin")
        .order("full_name");
      return data || [];
    },
  });

  // 6. Fetch employee usage
  const { data: employeeUsage = {} as Record<string, { used: number; total: number }> } = useQuery({
    queryKey: ["admin-employee-usage", selectedYear],
    queryFn: async () => {
      const yearRange = getLeaveYearRange(selectedYear);
      const { data: approved } = await supabase
        .from("leave_requests")
        .select("user_id, days_count, hours")
        .eq("status", "approved")
        .gte("start_date", yearRange.start)
        .lte("start_date", yearRange.end);
      const usage: Record<string, { used: number; total: number; halfDayHours: number }> = {};
      (approved || []).forEach((r: any) => {
        if (!usage[r.user_id]) usage[r.user_id] = { used: 0, total: Number(annualEntitlement) || 12, halfDayHours: 0 };
        usage[r.user_id].used += r.days_count;
        usage[r.user_id].halfDayHours += Number(r.hours || 0);
      });
      for (const id of Object.keys(usage)) {
        usage[id].used += Math.floor(usage[id].halfDayHours / 8);
        delete usage[id].halfDayHours;
      }
      return usage;
    },
    enabled: !!annualEntitlement,
  });

  const today = getPKTDateString();
  const currentMonth = today.substring(0, 7);

  const summaryStats = useMemo(() => {
    const employeesOnLeaveToday = new Set(
      requests.filter((r: any) =>
        r.status === "approved" && r.start_date <= today && r.end_date >= today
      ).map((r: any) => r.user_id)
    ).size;

    const leavesThisMonth = requests.filter((r: any) =>
      r.status === "approved" && r.start_date.startsWith(currentMonth)
    ).length;

    const entitlementVal = Number(annualEntitlement) || 12;
    const employeesAtLimit = Object.values(employeeUsage).filter(
      (u: any) => u.used >= entitlementVal
    ).length;

    return { employeesOnLeaveToday, leavesThisMonth, employeesAtLimit };
  }, [requests, today, currentMonth, employeeUsage, annualEntitlement]);

  const groupedByUser = useMemo(() => {
    const userMap = new Map<string, any[]>();
    filtered.forEach((r: any) => {
      const uid = r.user_id;
      if (!userMap.has(uid)) userMap.set(uid, []);
      userMap.get(uid)!.push(r);
    });

    for (const [, reqs] of userMap) {
      reqs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return Array.from(userMap.entries())
      .map(([userId, reqs]) => ({
        userId,
        user: reqs[0]?.users || null,
        requests: reqs,
        latest: reqs[0],
        usedDays: employeeUsage[userId]?.used || 0,
        totalDays: employeeUsage[userId]?.total || Number(annualEntitlement) || 12,
        isOversight: reqs[0]?.users?.is_oversight === true,
      }))
      .sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [filtered, employeeUsage, annualEntitlement]);

  const employeeBalanceData = useMemo(() => {
    const entitlementVal = Number(annualEntitlement) || 12;
    return allEmployees
      .map((emp: any) => {
        const usage = employeeUsage[emp.id];
        const used = usage?.used || 0;
        const total = usage?.total || entitlementVal;
        const remaining = Math.max(0, total - used);
        return { id: emp.id, name: emp.full_name, remaining, used, total };
      })
      .sort((a, b) => a.remaining - b.remaining);
  }, [allEmployees, employeeUsage, annualEntitlement]);

  const expandedEmployeeRequests = useMemo(() => {
    if (!expandedEmployeeId) return [];
    const yearRange = getLeaveYearRange(selectedYear);
    return requests
      .filter((r: any) =>
        r.user_id === expandedEmployeeId &&
        r.start_date >= yearRange.start &&
        r.start_date <= yearRange.end
      )
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [expandedEmployeeId, requests, selectedYear]);

  const wfhFiltered = useMemo(() => {
    if (wfhStatusFilter === "all") return wfhRequests;
    return wfhRequests.filter((r: any) => r.status === wfhStatusFilter);
  }, [wfhRequests, wfhStatusFilter]);

  const handleWfhAction = async (id: string, type: "approve" | "reject", userId: string) => {
    try {
      const newStatus = type === "approve" ? "approved" : "rejected";
      const { error } = await supabase.from("remote_work_requests").update({
        status: newStatus,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: type === "approve" ? "wfh.approved" : "wfh.rejected",
        target_entity: "remote_work_requests",
        target_id: id,
        metadata: { employee_id: userId, action: newStatus },
      });

      await supabase.from("notifications").insert({
        user_id: userId,
        type: `remote_work.${newStatus}`,
        channel: "in_app",
        metadata: { title: "Remote Work Request Updated", message: `Your remote work request was ${newStatus}` },
        read: false,
      });

      supabase.functions.invoke("send-request-notification", {
        body: { type: "wfh", action: newStatus, request_id: id, app_url: window.location.origin },
      }).catch(() => {});

      toast.success(`Work From Home request ${type}d`);
      await queryClient.refetchQueries({ queryKey: ["admin-wfh-requests"], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["pending-leave-count"], type: "all" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    const { type, request } = actionModal;
    if (type === "reject" && !adminComment.trim()) { toast.error("Rejection reason is required"); return; }

    if (type === "approve") {
      const currentLY = getCurrentLeaveYear();
      const entitlementVal = Number(annualEntitlement) || 12;
      const { data: approvedReqs } = await supabase
        .from("leave_requests")
        .select("days_count")
        .eq("user_id", request.user_id)
        .eq("status", "approved")
        .gte("start_date", currentLY.start)
        .lte("start_date", currentLY.end);
      const usedDays = (approvedReqs || []).reduce((s: number, r: any) => s + r.days_count, 0);
      const newTotal = usedDays + request.days_count;
      if (newTotal > entitlementVal) {
        toast.error(`Cannot approve — employee would exceed annual entitlement (${usedDays} used + ${request.days_count} requested > ${entitlementVal} allowed)`);
        setProcessing(false);
        return;
      }
    }

    setProcessing(true);
    try {
      const newStatus = type === "approve" ? "approved" : "rejected";
      const { error } = await supabase.from("leave_requests").update({
        status: newStatus,
        admin_comment: adminComment || null,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: type === "approve" ? "leave.approved" : "leave.rejected",
        target_entity: "leave_requests",
        target_id: request.id,
        metadata: { employee: request.users?.full_name, days: request.days_count, leave_type: getLeaveTypeName(request) },
      });

      await supabase.from("notifications").insert({
        user_id: request.user_id,
        type: `leave.${newStatus}`,
        channel: "in_app",
        metadata: { leave_type: getLeaveTypeName(request), days: request.days_count },
        read: false,
      });

      supabase.functions.invoke("send-request-notification", {
        body: { type: "leave", action: newStatus, request_id: request.id, admin_comment: adminComment || undefined, app_url: window.location.origin },
      }).catch(() => {});

      if (type === "approve" && request.hours) {
        const currentLY = getCurrentLeaveYear();
        const { data: halfDayData } = await supabase
          .from("leave_requests")
          .select("hours")
          .eq("user_id", request.user_id)
          .eq("status", "approved")
          .not("hours", "is", null)
          .gte("start_date", currentLY.start)
          .lte("start_date", currentLY.end);
        const totalHours = (halfDayData || []).reduce((s: number, r: any) => s + Number(r.hours), 0);
        const currentHours = Number(request.hours);
        const oldChunks = Math.floor((totalHours - currentHours) / 8);
        const newChunks = Math.floor(totalHours / 8);
        const additionalDeduction = newChunks - oldChunks;
        if (additionalDeduction > 0) {
          const { data: annualType } = await supabase
            .from("leave_types")
            .select("id")
            .ilike("name", "%annual%")
            .maybeSingle();
          if (annualType) {
            const { data: balance } = await supabase
              .from("leave_balances")
              .select("*")
              .eq("user_id", request.user_id)
              .eq("leave_type_id", annualType.id)
              .eq("year", currentLY.startYear)
              .maybeSingle();
            if (balance) {
              const newUsedDays = (balance.used_days || 0) + additionalDeduction;
              await supabase.from("leave_balances").update({ used_days: newUsedDays }).eq("id", balance.id);
              if (balance.total_days <= newUsedDays) {
                await supabase.from("notifications").insert({
                  user_id: request.user_id,
                  type: "leave.balance_exhausted",
                  channel: "in_app",
                  metadata: { message: "You have run out of Annual Leave days. Please contact your admin." },
                  read: false,
                });
              }
            }
          }
        }
      }

      toast.success(`Leave request ${type}d`);
      setActionModal(null);
      setAdminComment("");
      await queryClient.refetchQueries({ queryKey: ["admin-leave-requests"], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["pending-leave-count"], type: "all" });
    } catch (err: any) { toast.error(err.message); }
    finally { setProcessing(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("leave_requests").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "leave.deleted", target_entity: "leave_requests", target_id: deleteId });
      toast.success("Leave request deleted");
      setDeleteId(null);
      await queryClient.refetchQueries({ queryKey: ["admin-leave-requests"], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["pending-leave-count"], type: "all" });
    }
  };

  const handleWfhDelete = async () => {
    if (!wfhDeleteId) return;
    setWfhDeleting(true);
    const { error } = await supabase.from("remote_work_requests").delete().eq("id", wfhDeleteId);
    setWfhDeleting(false);
    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "wfh.deleted", target_entity: "remote_work_requests", target_id: wfhDeleteId });
      toast.success("Remote work request deleted");
      setWfhDeleteId(null);
      await queryClient.refetchQueries({ queryKey: ["admin-wfh-requests"], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["pending-leave-count"], type: "all" });
    }
  };

  const handleBulkDeleteLeave = async () => {
    const ids = Array.from(selectedLeaveIds);
    if (!ids.length) return;
    setDeleting(true);
    const { error } = await supabase.from("leave_requests").delete().in("id", ids);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    for (const id of ids) {
      await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "leave.deleted", target_entity: "leave_requests", target_id: id });
    }
    toast.success(`${ids.length} leave request${ids.length > 1 ? "s" : ""} deleted`);
    setSelectedLeaveIds(new Set());
    setBulkDeleteLeaveOpen(false);
    await queryClient.refetchQueries({ queryKey: ["admin-leave-requests"], type: "all" });
    await queryClient.refetchQueries({ queryKey: ["pending-leave-count"], type: "all" });
  };

  const handleBulkDeleteWfh = async () => {
    const ids = Array.from(selectedWfhIds);
    if (!ids.length) return;
    setWfhDeleting(true);
    const { error } = await supabase.from("remote_work_requests").delete().in("id", ids);
    setWfhDeleting(false);
    if (error) { toast.error(error.message); return; }
    for (const id of ids) {
      await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "wfh.deleted", target_entity: "remote_work_requests", target_id: id });
    }
    toast.success(`${ids.length} remote work request${ids.length > 1 ? "s" : ""} deleted`);
    setSelectedWfhIds(new Set());
    setBulkDeleteWfhOpen(false);
    await queryClient.refetchQueries({ queryKey: ["admin-wfh-requests"], type: "all" });
    await queryClient.refetchQueries({ queryKey: ["pending-leave-count"], type: "all" });
  };

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const approvedRequests = requests.filter((r: any) => r.status === "approved");

  const getLeavesForDay = (d: Date) => {
    const ds = format(d, "yyyy-MM-dd");
    return approvedRequests.filter((r: any) => r.start_date <= ds && r.end_date >= ds);
  };

  return {
    user,
    profile,
    statusFilter,
    setStatusFilter,
    actionModal,
    setActionModal,
    adminComment,
    setAdminComment,
    processing,
    deleteId,
    setDeleteId,
    deleting,
    wfhDeleteId,
    setWfhDeleteId,
    wfhDeleting,
    selectedLeaveIds,
    setSelectedLeaveIds,
    bulkDeleteLeaveOpen,
    setBulkDeleteLeaveOpen,
    selectedWfhIds,
    setSelectedWfhIds,
    bulkDeleteWfhOpen,
    setBulkDeleteWfhOpen,
    calMonth,
    setCalMonth,
    wfhStatusFilter,
    setWfhStatusFilter,
    leaveTypeFilter,
    setLeaveTypeFilter,
    submittedDate,
    setSubmittedDate,
    selectedYear,
    setSelectedYear,
    expandedId,
    setExpandedId,
    expandedEmployeeId,
    setExpandedEmployeeId,
    showBalanceDialog,
    setShowBalanceDialog,
    namesModal,
    setNamesModal,
    annualEntitlement,
    setAnnualEntitlement,
    savingEntitlement,
    bulkRemoteFrom,
    setBulkRemoteFrom,
    bulkRemoteTo,
    setBulkRemoteTo,
    bulkRemoteSubmitting,
    showBulkEnableConfirm,
    setShowBulkEnableConfirm,
    showBulkDisableConfirm,
    setShowBulkDisableConfirm,
    requests,
    filtered,
    wfhRequests,
    wfhFiltered,
    leaveTypes,
    allEmployees,
    employeeUsage,
    today,
    summaryStats,
    groupedByUser,
    employeeBalanceData,
    expandedEmployeeRequests,
    handleSaveEntitlement,
    handleBulkEnable,
    handleBulkDisable,
    handleWfhAction,
    handleAction,
    handleDelete,
    handleWfhDelete,
    handleBulkDeleteLeave,
    handleBulkDeleteWfh,
    calDays,
    getLeavesForDay,
    subMonths,
    addMonths,
  };
}
