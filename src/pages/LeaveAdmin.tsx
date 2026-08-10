import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Table, TableBody, TableCell, TableHead, TableHeader as ShadcnTableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, ChevronLeft, ChevronRight, Save, Trash2, CalendarCheck, CalendarDays, AlertTriangle, Eye, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend } from "date-fns";
import { getPKTDateString } from "@/hooks/useWorkSettings";

const LEAVE_CATEGORIES = ["Sick Leave", "Casual Leave", "Hourly Leave", "Others"];

import { getLeaveTypeName, getCurrentLeaveYear, getLeaveYearRange, getLeaveYearOptions } from "@/lib/utils";

export default function LeaveAdminPage() {
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
  const [calMonth, setCalMonth] = useState(new Date());
  const [wfhStatusFilter, setWfhStatusFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [submittedDate, setSubmittedDate] = useState("");
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentLeaveYear().startYear);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Annual leave entitlement setting
  const [annualEntitlement, setAnnualEntitlement] = useState("12");
  const [savingEntitlement, setSavingEntitlement] = useState(false);

  // Bulk remote access
  const [bulkRemoteFrom, setBulkRemoteFrom] = useState("");
  const [bulkRemoteTo, setBulkRemoteTo] = useState("");
  const [bulkRemoteSubmitting, setBulkRemoteSubmitting] = useState(false);
  const [showBulkEnableConfirm, setShowBulkEnableConfirm] = useState(false);
  const [showBulkDisableConfirm, setShowBulkDisableConfirm] = useState(false);

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
      const matchSearch = !searchQuery.trim() || (r.users?.full_name || "").toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchStatus && matchYear && matchLeaveType && matchSubmitted && matchSearch;
    });
  }, [requests, statusFilter, selectedYear, leaveTypeFilter, submittedDate, searchQuery]);

  const { data: wfhRequests = [] } = useQuery({
    queryKey: ["admin-wfh-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("remote_work_requests")
        .select("*, users!remote_work_requests_user_id_fkey(full_name, designation, is_oversight), reviewer:users!remote_work_requests_reviewed_by_fkey(full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("*").order("name");
      return data || [];
    },
  });

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

  // Per-employee used days for the selected leave year
  // Includes full-day leaves (days_count) + half-day leaves converted to day-equivalent (every 8 hours = 1 day)
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

  // Summary strip stats
  const summaryStats = useMemo(() => {
    const employeesOnLeaveToday = new Set(
      requests.filter((r: any) =>
        r.status === "approved" && r.start_date <= today && r.end_date >= today
      ).map((r: any) => r.user_id)
    ).size;

    const leavesThisMonth = requests.filter((r: any) =>
      r.status === "approved" && r.start_date.startsWith(currentMonth)
    ).length;

    const pendingApprovals = requests.filter((r: any) => r.status === "pending").length;

    return { employeesOnLeaveToday, leavesThisMonth, pendingApprovals };
  }, [requests, today, currentMonth]);

  // Group filtered requests by employee for the grouped layout
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

  // All requests for the expanded employee (within the selected year, unfiltered)
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

    // Check entitlement on approval (using leave year)
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
        metadata: { leave_type: getLeaveTypeName(request), days: request.days_count },
      });

      supabase.functions.invoke("send-request-notification", {
        body: { type: "leave", action: newStatus, request_id: request.id, admin_comment: adminComment || undefined, app_url: window.location.origin },
      }).catch(() => {});

      // Half-day leave → Annual Leave conversion (using leave year)
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
                  metadata: { message: "You have run out of Annual Leave days. Please contact your admin." },
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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { pending: "bg-yellow-100 text-yellow-800", approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-500" };
    return <Badge className={`${map[status] || ""} capitalize`}>{status}</Badge>;
  };

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const approvedRequests = requests.filter((r: any) => r.status === "approved");
  const getLeavesForDay = (d: Date) => {
    const ds = format(d, "yyyy-MM-dd");
    return approvedRequests.filter((r: any) => r.start_date <= ds && r.end_date >= ds);
  };

  const [namesModal, setNamesModal] = useState<{ date: string; leaves: any[] } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-[#09090B] tracking-tight leading-none mb-1">
            Leave Management
          </h1>
          <p className="text-[13px] text-[#71717A]">
            Leave year: {getLeaveYearRange(selectedYear).label}
          </p>
        </div>
        <Button className="bg-[#EC6824] hover:bg-[#c4541a] text-white rounded-md h-9 px-4 text-[13px] font-medium shadow-sm">
          + Apply Leave
        </Button>
      </div>
      <Tabs defaultValue="requests">
        <TabsList className="bg-transparent border-b border-[#E4E4E7] rounded-none p-0 h-auto gap-0">
          <TabsTrigger value="requests" className="relative rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] font-medium text-[#71717A] data-[state=active]:border-[#09090B] data-[state=active]:text-[#09090B] data-[state=active]:shadow-none hover:text-[#09090B] transition-colors">
            Leave Requests
            {requests.filter((r: any) => r.status === "pending").length > 0 && (
              <span className="ml-2 bg-[#EC6824] text-white text-[10px] font-bold rounded-md h-5 min-w-[20px] inline-flex items-center justify-center px-1">
                {requests.filter((r: any) => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="wfh" className="relative rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] font-medium text-[#71717A] data-[state=active]:border-[#09090B] data-[state=active]:text-[#09090B] data-[state=active]:shadow-none hover:text-[#09090B] transition-colors">
            Remote Requests
            {wfhRequests.filter((r: any) => r.status === "pending").length > 0 && (
              <span className="ml-2 bg-[#EC6824] text-white text-[10px] font-bold rounded-md h-5 min-w-[20px] inline-flex items-center justify-center px-1">
                {wfhRequests.filter((r: any) => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="relative rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] font-medium text-[#71717A] data-[state=active]:border-[#09090B] data-[state=active]:text-[#09090B] data-[state=active]:shadow-none hover:text-[#09090B] transition-colors">Calendar</TabsTrigger>
          <TabsTrigger value="settings" className="relative rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] font-medium text-[#71717A] data-[state=active]:border-[#09090B] data-[state=active]:text-[#09090B] data-[state=active]:shadow-none hover:text-[#09090B] transition-colors">Leave Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-0 mt-0">
          {/* ── SUMMARY CARDS ── */}
          <div className="grid grid-cols-3 border border-[#E4E4E7] rounded-[16px] bg-white overflow-hidden mb-6">
            <div className="flex items-center gap-3 px-5 py-4 border-r border-[#E4E4E7]">
              <div className="h-10 w-10 rounded-lg bg-[#EBF5FF] flex items-center justify-center shrink-0">
                <CalendarCheck className="h-5 w-5 text-[#3B82F6]" />
              </div>
              <div>
                <p className="text-[12px] text-[#71717A]">On leave today</p>
                <p className="text-[22px] font-bold text-[#09090B] leading-tight">{summaryStats.employeesOnLeaveToday}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-r border-[#E4E4E7]">
              <div className="h-10 w-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[12px] text-[#71717A]">Leaves taken this month</p>
                <p className="text-[22px] font-bold text-[#09090B] leading-tight">{summaryStats.leavesThisMonth}</p>
              </div>
            </div>
            <button
              onClick={() => setShowBalanceDialog(true)}
              className="flex items-center gap-3 px-5 py-4 hover:bg-[#FFF4EA] transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-[#FFF4EA] flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-[#EC6824]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[12px] text-[#71717A]">Pending approvals</p>
                <p className="text-[22px] font-bold text-[#09090B] leading-tight">{summaryStats.pendingApprovals}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#A1A1AA]" />
            </button>
          </div>

          {/* ── SEARCH + FILTERS ── */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
              <Input
                type="text"
                placeholder="Search by employee name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-md border-[#E4E4E7] bg-white h-10 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] shadow-sm focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824]"
              />
            </div>
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger className="w-[130px] h-10 text-[13px] font-medium text-[#09090B] border-[#E4E4E7] bg-white shadow-sm rounded-md hover:border-[#EC6824] hover:bg-[#FFF4EA] focus:border-[#EC6824] focus:ring-2 focus:ring-[#EC6824]/20 data-[state=open]:border-[#EC6824] transition-colors">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {LEAVE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] h-10 text-[13px] font-medium text-[#09090B] border-[#E4E4E7] bg-white shadow-sm rounded-md hover:border-[#EC6824] hover:bg-[#FFF4EA] focus:border-[#EC6824] focus:ring-2 focus:ring-[#EC6824]/20 data-[state=open]:border-[#EC6824] transition-colors">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── LEAVE TABLE ── */}
          <div className="border border-[#E4E4E7] rounded-[16px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-[#71717A] text-[13px]">No requests</div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="px-6 py-3 border-b border-[#E4E4E7] grid gap-4 items-center text-[10px] font-bold text-[#A1A1AA] tracking-wider uppercase bg-transparent"
                  style={{ gridTemplateColumns: "40px 1.8fr 120px 120px 80px 100px 80px" }}>
                  <span></span>
                  <span>EMPLOYEE</span>
                  <span>FROM</span>
                  <span>TO</span>
                  <span>DAYS</span>
                  <span>STATUS</span>
                  <span className="text-right">ACTIONS</span>
                </div>

                {/* Table Rows */}
                <div className="flex flex-col bg-white">
                  {filtered.map((r: any) => {
                    const initials = (r.users?.full_name || "").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    const avatarColors: Record<string, string> = {
                      "AB": "bg-[#E9D5FF] text-[#7C3AED]",
                      "AZ": "bg-[#E9D5FF] text-[#7C3AED]",
                      "SH": "bg-[#DBEAFE] text-[#2563EB]",
                      "SM": "bg-[#D1FAE5] text-[#059669]",
                      "AR": "bg-[#DBEAFE] text-[#2563EB]",
                      "FA": "bg-[#FEE2E2] text-[#DC2626]",
                      "FR": "bg-[#FED7AA] text-[#EA580C]",
                      "HA": "bg-[#FEF3C7] text-[#D97706]",
                    };
                    const colorKey = initials;
                    const defaultColor = "bg-[#F3F4F6] text-[#6B7280]";
                    const leaveTypeTagColors: Record<string, string> = {
                      "Casual Leave": "bg-[#D1FAE5] text-[#059669]",
                      "Sick Leave": "bg-[#FEE2E2] text-[#DC2626]",
                      "Hourly Leave": "bg-[#DBEAFE] text-[#2563EB]",
                      "Half Day Leave": "bg-[#D1FAE5] text-[#059669]",
                      "Annual Leave": "bg-[#DBEAFE] text-[#2563EB]",
                      "Others": "bg-[#F3F4F6] text-[#6B7280]",
                    };
                    const typeName = getLeaveTypeName(r);
                    const tagColor = leaveTypeTagColors[typeName] || "bg-[#F3F4F6] text-[#6B7280]";
                    return (
                      <div
                        key={r.id}
                        className="px-6 py-3.5 border-b border-[#F4F4F5] last:border-b-0 grid gap-4 items-center hover:bg-[#FFF1E6] transition-colors"
                        style={{ gridTemplateColumns: "40px 1.8fr 120px 120px 80px 100px 80px" }}
                      >
                        {/* Checkbox */}
                        <div>
                          <input type="checkbox" className="h-4 w-4 rounded border-[#D4D4D8] text-[#EC6824] focus:ring-[#EC6824]/20 cursor-pointer" />
                        </div>

                        {/* Employee */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarColors[colorKey] || defaultColor}`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-[#18181B] truncate tracking-tight">
                              {r.users?.full_name || "Unknown"}
                            </p>
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md mt-0.5 ${tagColor}`}>
                              {typeName}
                            </span>
                          </div>
                        </div>

                        {/* From */}
                        <div className="text-[13px] text-[#52525B]">
                          {format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}
                        </div>

                        {/* To */}
                        <div className="text-[13px] text-[#52525B]">
                          {format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}
                        </div>

                        {/* Days */}
                        <div className="text-[13px] text-[#52525B]">
                          {r.hours ? `${r.hours} hrs` : `${r.days_count} day${r.days_count !== 1 ? "s" : ""}`}
                        </div>

                        {/* Status */}
                        <div>
                          {statusBadge(r.status)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "pending" && (
                            <>
                              <button
                                onClick={() => setActionModal({ type: "approve", request: r })}
                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0] transition-colors"
                                title="Approve"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setActionModal({ type: "reject", request: r })}
                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] transition-colors"
                                title="Reject"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedEmployeeId(r.user_id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#F4F4F5] text-[#71717A] hover:bg-[#E4E4E7] transition-colors"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Employee Leave Balance</DialogTitle>
              </DialogHeader>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <ShadcnTableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead className="text-right">Remaining Leave Days</TableHead>
                    </TableRow>
                  </ShadcnTableHeader>
                  <TableBody>
                    {employeeBalanceData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                          No employees found
                        </TableCell>
                      </TableRow>
                    ) : employeeBalanceData.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell className="text-right font-medium">{emp.remaining}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="wfh" className="space-y-4">
          <div className="flex gap-3">
            <Select value={wfhStatusFilter} onValueChange={setWfhStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {wfhFiltered.length === 0 ? (
            <Card><div className="py-12 text-center text-muted-foreground">No Remote Requests</div></Card>
          ) : (
            <div>
              <TableHeader gridCols="1fr 1fr 80px 112px 96px 1fr 80px">
                <span>EMPLOYEE</span>
                <span>DATE RANGE</span>
                <span>DAYS</span>
                <span>SUBMITTED</span>
                <span>STATUS</span>
                <span>REVIEWED</span>
                <span className="text-right">ACTIONS</span>
              </TableHeader>
              {wfhFiltered.map((r: any) => (
                <React.Fragment key={r.id}>
                  <DataRow
                    className={`${r.users?.is_oversight ? "bg-amber-50/70" : r.status === "pending" ? "bg-yellow-50/50" : ""}`}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    gridCols="1fr 1fr 80px 112px 96px 1fr 80px"
                  >
                    <div>
                      <RowPrimary>{r.users?.full_name}</RowPrimary>
                      <RowSecondary>{r.users?.designation || "—"}</RowSecondary>
                    </div>
                    <RowDataItem label="DATE RANGE">
                      {r.start_date === r.end_date
                        ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")
                        : `${format(new Date(r.start_date + "T00:00:00"), "MMM d")} — ${format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}`
                      }
                    </RowDataItem>
                    <RowDataItem label="DAYS">{r.days_count}</RowDataItem>
                    <RowDataItem label="SUBMITTED">{format(new Date(r.created_at), "MMM d, yyyy")}</RowDataItem>
                    <RowBadgeItem label="STATUS">{statusBadge(r.status)}</RowBadgeItem>
                    <RowDataItem label="REVIEWED">
                      {r.reviewed_at ? (
                        <>{format(new Date(r.reviewed_at), "MMM d")} <span className="text-[11px] text-[#9ca3af]">by {r.reviewer?.full_name || "Admin"}</span></>
                      ) : "—"}
                    </RowDataItem>
                    <RowActions className="justify-self-end">
                      {r.status === "pending" && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleWfhAction(r.id, "approve", r.user_id); }} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-green-600" title="Approve"><Check className="h-4 w-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleWfhAction(r.id, "reject", r.user_id); }} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Reject"><X className="h-4 w-4" /></button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setWfhDeleteId(r.id); }} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </RowActions>
                  </DataRow>
                  {expandedId === r.id && (
                    <div className="bg-[#f9fafb] border-b border-[#f3f4f6] px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Employee</p>
                          <p className="text-sm font-medium text-[#111827] mt-0.5">{r.users?.full_name}</p>
                          <p className="text-xs text-[#6b7280]">{r.users?.designation || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Date Range</p>
                          <p className="text-sm text-[#374151] mt-0.5">
                            {r.start_date === r.end_date
                              ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")
                              : `${format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")} — ${format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}`
                            }
                          </p>
                          <p className="text-xs text-[#6b7280]">{r.days_count} working day(s)</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Submitted On</p>
                          <p className="text-sm text-[#374151] mt-0.5">{format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Reason</p>
                        <p className="text-sm text-[#374151] mt-0.5 whitespace-pre-wrap">{r.reason || "No reason provided"}</p>
                      </div>
                      {r.status !== "pending" && (
                        <div className="flex items-center gap-2 mt-2">
                          {statusBadge(r.status)}
                          {r.reviewed_at && (
                            <span className="text-xs text-[#6b7280]">
                              Reviewed {format(new Date(r.reviewed_at), "MMM d, yyyy 'at' h:mm a")} by {r.reviewer?.full_name || "Admin"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <h3 className="font-semibold">{format(calMonth, "MMMM yyyy")}</h3>
              <Button variant="ghost" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: calDays[0].getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
              {calDays.map((d) => {
                const leaves = getLeavesForDay(d);
                return (
                  <div key={d.toISOString()} className={`min-h-[60px] p-1 rounded text-xs border ${d.getDay() === 0 ? "bg-muted opacity-60 blur-sm" : "bg-card"}`}>
                    <span className="font-medium">{d.getDate()}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {leaves.slice(0, 2).map((l: any) => {
                        const initials = l.users?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                        return (
                          <div key={l.id} className="flex items-center gap-1" title={`${l.users?.full_name} - ${getLeaveTypeName(l)}`}>
                            <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{initials}</AvatarFallback></Avatar>
                            <span className="truncate">{l.users?.full_name?.split(" ")[0]}</span>
                          </div>
                        );
                      })}
                      {leaves.length > 2 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); const ds = format(d, "yyyy-MM-dd"); setNamesModal({ date: ds, leaves }); }}
                          className="text-muted-foreground text-xs ml-1 underline"
                        >+{leaves.length - 2}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Dialog open={!!namesModal} onOpenChange={() => setNamesModal(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Employees on {namesModal?.date}</DialogTitle>
              </DialogHeader>
              <div className="p-3">
                {namesModal?.leaves && namesModal.leaves.length > 0 ? (
                  <div className="divide-y divide-black/30">
                    {namesModal.leaves.map((l: any) => (
                      <div key={l.id} className="flex items-center gap-3 py-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{(l.users?.full_name || "").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</div>
                        <div>
                          <p className="text-sm font-medium">{l.users?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{getLeaveTypeName(l)} · {l.hours ? "0.5" : l.days_count} day(s)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No employees</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Leave Configuration</h3>
              <Button onClick={handleSaveEntitlement} disabled={savingEntitlement} className="rounded-button">
                <Save className="h-4 w-4 mr-2" />{savingEntitlement ? "Saving…" : "Save"}
              </Button>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label>Annual Leave Entitlement (days)</Label>
              <Input type="number" value={annualEntitlement} onChange={(e) => setAnnualEntitlement(e.target.value)} min="0" max="365" />
              <p className="text-xs text-muted-foreground">Total annual leave days each employee is entitled to per year. All leave types draw from this single pool.</p>
            </div>
            <div className="mt-4">
              <Label className="text-sm font-medium">Leave Categories (for tracking)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {LEAVE_CATEGORIES.map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">These categories are fixed and used for tracking purposes only. All draw from the single annual pool.</p>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">Remote Access</h3>
            <p className="text-sm text-muted-foreground">
              Enable or disable remote work for all non-admin users at once.
              Employees who already have individual remote access enabled will be skipped.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <div className="space-y-1">
                <Label>From Date</Label>
                <Input type="date" value={bulkRemoteFrom} onChange={(e) => setBulkRemoteFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To Date</Label>
                <Input type="date" value={bulkRemoteTo} onChange={(e) => setBulkRemoteTo(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowBulkEnableConfirm(true)} disabled={bulkRemoteSubmitting}>
                Enable Remote Access
              </Button>
              <Button variant="outline" onClick={() => setShowBulkDisableConfirm(true)} disabled={bulkRemoteSubmitting}>
                Disable Remote Access
              </Button>
            </div>
          </Card>

          <AlertDialog open={showBulkEnableConfirm} onOpenChange={setShowBulkEnableConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Enable Remote Access for All Users?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will enable remote access for all non-admin users from{" "}
                  <strong>{bulkRemoteFrom || "—"}</strong> to{" "}
                  <strong>{bulkRemoteTo || bulkRemoteFrom || "—"}</strong>.
                  Users who already have individual remote access settings will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={bulkRemoteSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkEnable} disabled={bulkRemoteSubmitting}>
                  {bulkRemoteSubmitting ? "Enabling…" : "Enable"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showBulkDisableConfirm} onOpenChange={setShowBulkDisableConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable Bulk Remote Access?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will disable remote access for all non-admin users who were previously enabled
                  via the bulk action. Users with individual remote access settings will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={bulkRemoteSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDisable} disabled={bulkRemoteSubmitting}>
                  {bulkRemoteSubmitting ? "Disabling…" : "Disable"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>

      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionModal?.type === "approve" ? "Approve" : "Reject"} Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm"><strong>{actionModal?.request?.users?.full_name}</strong> — {actionModal?.request?.leave_types?.name} ({actionModal?.request?.days_count} days)</p>
            <div className="space-y-1">
              <Label>{actionModal?.type === "reject" ? "Rejection Reason *" : "Comment (optional)"}</Label>
              <Textarea value={adminComment} onChange={(e) => setAdminComment(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button onClick={handleAction} disabled={processing}
              className={actionModal?.type === "approve" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}>
              {processing ? "Processing…" : actionModal?.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this leave request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!wfhDeleteId} onOpenChange={(o) => !o && setWfhDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Remote Work Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this remote work request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wfhDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWfhDelete} disabled={wfhDeleting} className="bg-destructive hover:bg-destructive/90">
              {wfhDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
