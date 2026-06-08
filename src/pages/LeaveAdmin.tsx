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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, ChevronLeft, ChevronRight, Save, ChevronDown, ChevronUp, Trash2, CalendarCheck, CalendarDays, AlertTriangle } from "lucide-react";
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

  // Annual leave entitlement setting
  const [annualEntitlement, setAnnualEntitlement] = useState("12");
  const [savingEntitlement, setSavingEntitlement] = useState(false);

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

    const entitlementVal = Number(annualEntitlement) || 12;
    const employeesAtLimit = Object.values(employeeUsage).filter(
      (u: any) => u.used >= entitlementVal
    ).length;

    return { employeesOnLeaveToday, leavesThisMonth, employeesAtLimit };
  }, [requests, today, currentMonth, employeeUsage, annualEntitlement]);

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
      <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" className="relative">
            Leave Requests
            {requests.filter((r: any) => r.status === "pending").length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                {requests.filter((r: any) => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="wfh" className="relative">
            Remote Requests
            {wfhRequests.filter((r: any) => r.status === "pending").length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                {wfhRequests.filter((r: any) => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="settings">Leave Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leave Year: {getLeaveYearRange(selectedYear).label}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getLeaveYearOptions().map((y) => (
                  <SelectItem key={y.startYear} value={String(y.startYear)}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Leave Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {LEAVE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={submittedDate} onChange={(e) => setSubmittedDate(e.target.value)} className="w-[160px]" placeholder="Submitted date" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.employeesOnLeaveToday}</p>
                <p className="text-xs text-muted-foreground">Employees on leave today</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.leavesThisMonth}</p>
                <p className="text-xs text-muted-foreground">Leaves taken this month</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.employeesAtLimit}</p>
                <p className="text-xs text-muted-foreground">Employees at annual limit</p>
              </div>
            </Card>
          </div>

          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead>Used / Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {groupedByUser.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No requests</TableCell></TableRow>
                ) : groupedByUser.map((group) => (
                  <React.Fragment key={group.userId}>
                    <TableRow
                      className={`cursor-pointer relative${group.isOversight ? " bg-amber-50/70" : group.latest.status === "pending" ? " bg-yellow-50/50" : " bg-muted/20"}`}
                      onClick={() => setExpandedEmployeeId(expandedEmployeeId === group.userId ? null : group.userId)}
                    >
                      <TableCell className="relative">
                        {expandedEmployeeId === group.userId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                              </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{group.user?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{group.user?.department}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{getLeaveTypeName(group.latest)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(group.latest.start_date + "T00:00:00"), "MMM d")}
                        {(group.latest.start_date !== group.latest.end_date || !group.latest.hours) && (
                          <> — {format(new Date(group.latest.end_date + "T00:00:00"), "MMM d")}</>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{group.latest.hours ? `${group.latest.hours} hrs` : group.latest.days_count}</TableCell>
                      <TableCell className="max-w-[180px] whitespace-normal break-words text-sm">{group.latest.reason || "—"}</TableCell>
                      <TableCell>{statusBadge(group.latest.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(group.latest.created_at), "MMM d")}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <span className={group.usedDays >= group.totalDays ? "text-destructive font-medium" : ""}>
                          {group.usedDays} / {group.totalDays} days
                        </span>
                        {group.usedDays >= group.totalDays && (
                          <span className="text-destructive text-xs block">limit reached</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedEmployeeId === group.userId && (
                      <TableRow key={`${group.userId}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/50 p-0">
                          <div className="p-4 space-y-3">
                            {expandedEmployeeRequests.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No leave requests found for this period</p>
                            ) : expandedEmployeeRequests.map((r: any) => (
                              <div key={r.id} className="border rounded-lg p-3 bg-card">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-2">
                                  <div className="md:col-span-1">
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Leave Type</p>
                                    <p className="text-sm font-medium">{getLeaveTypeName(r)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Dates</p>
                                    <p className="text-sm">{format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")} — {format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}</p>
                                    <p className="text-xs text-muted-foreground">{r.hours ? `${r.hours} hrs` : `${r.days_count} day(s)`}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Status</p>
                                    <div>{statusBadge(r.status)}</div>
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Submitted</p>
                                    <p className="text-sm">{format(new Date(r.created_at), "MMM d, yyyy")}</p>
                                    {r.reviewed_at && (
                                      <p className="text-xs text-muted-foreground">Reviewed {format(new Date(r.reviewed_at), "MMM d")}</p>
                                    )}
                                  </div>
                                  <div className="flex items-start justify-end gap-1 pt-4">
                                    {r.status === "pending" && (
                                      <>
                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setActionModal({ type: "approve", request: r }); }}>Approve</Button>
                                        <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setActionModal({ type: "reject", request: r }); }}>Reject</Button>
                                      </>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }} className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                    {r.status !== "pending" && r.admin_comment && (
                                      <span className="text-xs text-muted-foreground" title={r.admin_comment}>💬</span>
                                    )}
                                  </div>
                                </div>
                                <div className="mb-2">
                                  <p className="text-[11px] text-muted-foreground mb-0.5">Reason</p>
                                  <p className="text-sm whitespace-normal break-words">{r.reason || "—"}</p>
                                </div>
                                {r.admin_comment && (
                                  <div className="mb-2">
                                    <p className="text-[11px] text-muted-foreground mb-0.5">Admin Comment</p>
                                    <p className="text-sm">{r.admin_comment}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
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
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Requested Date</TableHead>
                <TableHead>Submitted On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {wfhFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No Remote Requests</TableCell></TableRow>
                ) : wfhFiltered.map((r: any) => (
                  <>
                    <TableRow key={r.id} className={`cursor-pointer relative${r.users?.is_oversight ? " bg-amber-50/70" : r.status === "pending" ? " bg-yellow-50/50" : ""}`} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      <TableCell className="relative">{expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">{r.users?.full_name}</TableCell>
                      <TableCell>{format(new Date(r.date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.reviewed_at ? (
                          <>
                            {format(new Date(r.reviewed_at), "MMM d")}
                            <br />
                            <span className="text-xs">by {r.reviewer?.full_name || "Admin"}</span>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 items-center">
                          {r.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleWfhAction(r.id, "approve", r.user_id); }} className="text-green-600"><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleWfhAction(r.id, "reject", r.user_id); }} className="text-destructive"><X className="h-4 w-4" /></Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setWfhDeleteId(r.id); }} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === r.id && (
                      <TableRow key={`${r.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/50 p-0">
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Employee</p>
                                <p className="text-sm font-medium">{r.users?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{r.users?.designation || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Requested Date</p>
                                <p className="text-sm">{format(new Date(r.date + "T00:00:00"), "MMM d, yyyy")}</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Submitted On</p>
                                <p className="text-sm">{format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                              </div>
                            </div>
                            <div className="mb-3">
                              <p className="text-[12px] text-muted-foreground mb-0.5">Reason</p>
                              <p className="text-sm whitespace-pre-wrap">{r.reason || "No reason provided"}</p>
                            </div>
                            {r.status !== "pending" && (
                              <div className="flex items-center gap-2 mt-2">
                                {statusBadge(r.status)}
                                {r.reviewed_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Reviewed {format(new Date(r.reviewed_at), "MMM d, yyyy 'at' h:mm a")} by {r.reviewer?.full_name || "Admin"}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </Card>
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
                  <div key={d.toISOString()} className={`min-h-[60px] p-1 rounded text-xs border ${isWeekend(d) ? "bg-muted opacity-60 blur-sm" : "bg-card"}`}>
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
