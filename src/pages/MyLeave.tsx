import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useWorkSettings, getPKTDateString, getPKTISOString } from "@/hooks/useWorkSettings";
import { getCurrentLeaveYear, getLeaveYearRange, getLeaveYearOptions } from "@/lib/utils";

const LEAVE_CATEGORIES = [
  { value: "sick", label: "Sick Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "half_day", label: "Hourly Leave" },
  { value: "other", label: "Others" },
];

export default function MyLeavePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`leave_last_seen_${user.id}`, new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ["employee-unseen-requests"] });
    }
  }, [user?.id, queryClient]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [leaveCategory, setLeaveCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyYear, setHistoryYear] = useState<number>(getCurrentLeaveYear().startYear);
  const { shiftStart, shiftEnd, workingDays } = useWorkSettings();
  const today = getPKTDateString();
  const tomorrow = getPKTDateString(new Date(Date.now() + 86400000));
  const [leaveHours, setLeaveHours] = useState("");

  // Work From Home state
  const [wfhStartDate, setWfhStartDate] = useState("");
  const [wfhEndDate, setWfhEndDate] = useState("");
  const [wfhReason, setWfhReason] = useState("");
  const [wfhSubmitting, setWfhSubmitting] = useState(false);

  const { data: wfhRequests = [] } = useQuery({
    queryKey: ["my-wfh-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("remote_work_requests").select("*, users!remote_work_requests_reviewed_by_fkey(full_name)").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleWfhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wfhStartDate || !wfhEndDate) { toast.error("Please select both From and To dates"); return; }
    if (wfhStartDate <= today) { toast.error("Start date must be a future date (tomorrow or later)"); return; }
    if (wfhEndDate < wfhStartDate) { toast.error("End date must be on or after start date"); return; }
    if (!wfhReason.trim()) { toast.error("Please enter a reason"); return; }

    const wfhDaysCount = countWorkingDays(wfhStartDate, wfhEndDate, workingDays);

    // Check if there is already a pending or approved request overlapping this range
    const existing = wfhRequests.find((r: any) =>
      r.start_date <= wfhEndDate && r.end_date >= wfhStartDate &&
      (r.status === "pending" || r.status === "approved")
    );
    if (existing) {
      toast.error(`You already have a ${existing.status} request that overlaps this date range.`);
      return;
    }

    setWfhSubmitting(true);
    try {
      const { data: newRequest, error } = await supabase.from("remote_work_requests").insert({
        user_id: user!.id,
        start_date: wfhStartDate,
        end_date: wfhEndDate,
        days_count: wfhDaysCount,
        reason: wfhReason.trim(),
        status: "pending"
      }).select("id").single();
      if (error) throw error;

      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "wfh.requested", target_entity: "remote_work_requests" });

      supabase.functions.invoke("send-request-notification", {
        body: { type: "wfh", action: "new", request_id: newRequest.id, app_url: window.location.origin },
      }).catch(() => {});

      toast.success("Work From Home request submitted");
      setWfhStartDate("");
      setWfhEndDate("");
      setWfhReason("");
      queryClient.invalidateQueries({ queryKey: ["my-wfh-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWfhSubmitting(false);
    }
  };

  const calculateMaxLeaveHours = (dateStr: string) => {
    if (!dateStr || !shiftStart || !shiftEnd) return 9; // default fallback
    const parseShiftTime = (timeStr: string) => {
      const parts = timeStr.split(":");
      return {
        hours: Number(parts[0]) || 0,
        minutes: Number(parts[1]) || 0,
      };
    };
    const s = parseShiftTime(shiftStart);
    const e = parseShiftTime(shiftEnd);
    let sMin = s.hours * 60 + s.minutes;
    let eMin = e.hours * 60 + e.minutes;
    if (eMin < sMin) eMin += 24 * 60; // overnight
    
    const isToday = dateStr === today;
    let remainingMinutes = eMin - sMin;
    
    if (isToday) {
      const pktIso = getPKTISOString();
      const pktTimePart = pktIso.split("T")[1].split("+")[0];
      const currentPkt = parseShiftTime(pktTimePart);
      let nowMin = currentPkt.hours * 60 + currentPkt.minutes;
      
      if (eMin > 24 * 60 && nowMin < (eMin - 24 * 60)) {
        nowMin += 24 * 60;
      }
      
      if (nowMin >= sMin && nowMin < eMin) {
        remainingMinutes = eMin - nowMin;
      } else if (nowMin >= eMin) {
        remainingMinutes = 0;
      }
    }
    
    return Math.max(0, Number((remainingMinutes / 60).toFixed(1)));
  };

  const maxLeaveHours = useMemo(() => calculateMaxLeaveHours(startDate), [startDate, today, shiftStart, shiftEnd]);

  const hoursError = useMemo(() => {
    if (leaveCategory !== "half_day") return "";
    if (!leaveHours.trim()) return "";
    const hoursNum = parseFloat(leaveHours);
    if (isNaN(hoursNum)) {
      return "Please enter a valid number of hours";
    }
    if (hoursNum <= 0) {
      return "Hours requested must be greater than zero";
    }
    if (hoursNum > maxLeaveHours) {
      return `You cannot take more hours than your remaining shift hours. You have ${maxLeaveHours} hours remaining`;
    }
    return "";
  }, [leaveCategory, leaveHours, maxLeaveHours]);


  // Live global entitlement from system_settings
  const { data: annualEntitlement = 12 } = useQuery({
    queryKey: ["system-setting-annual-leave"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "annual_leave_entitlement").maybeSingle();
      return data ? Number(data.value) : 12;
    },
    refetchInterval: 30000, // poll every 30s for real-time sync
  });

  // Current leave year for balance calculations
  const currentLeaveYear = useMemo(() => getCurrentLeaveYear(), []);

  // Calculate used days from approved leave requests (live calculation, current leave year)
  // Includes full-day leaves (days_count) + half-day leaves converted to day-equivalent (every 8 hours = 1 day)
  const { data: usedDays = 0 } = useQuery({
    queryKey: ["my-used-leave-days", user?.id, currentLeaveYear.startYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("days_count, hours")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .gte("start_date", currentLeaveYear.start)
        .lte("start_date", currentLeaveYear.end);
      const daySum = (data || []).reduce((sum, r) => sum + r.days_count, 0);
      const hourSum = (data || []).reduce((sum, r) => sum + Number(r.hours || 0), 0);
      return daySum + Math.floor(hourSum / 8);
    },
    enabled: !!user?.id,
  });

  // Half-day hours used (current leave year)
  const { data: halfDayHours = 0 } = useQuery({
    queryKey: ["my-half-day-hours", user?.id, currentLeaveYear.startYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("hours")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .not("hours", "is", null)
        .gte("start_date", currentLeaveYear.start)
        .lte("start_date", currentLeaveYear.end);
      return (data || []).reduce((sum, r) => sum + Number(r.hours), 0) % 8;
    },
    enabled: !!user?.id,
  });

  const totalDays = annualEntitlement;
  const remainingDays = Math.max(0, totalDays - usedDays);
  const isExhausted = remainingDays <= 0;

  const { data: requests = [] } = useQuery({
    queryKey: ["my-leave-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("*, leave_types(name), users!leave_requests_reviewed_by_fkey(full_name)").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const filteredRequests = useMemo(() => {
    const yearRange = getLeaveYearRange(historyYear);
    return requests.filter((r: any) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchYear = r.start_date >= yearRange.start && r.start_date <= yearRange.end;
      return matchStatus && matchYear;
    });
  }, [requests, statusFilter, historyYear]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function countWorkingDays(start: string, end: string, daysPerWeek: number) {
    const startDate = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const d = current.getDay();
      if (daysPerWeek === 5) {
        if (d !== 0 && d !== 6) count++;
      } else {
        if (d !== 0) count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return Math.max(1, count);
  }
  const workingDaysCount = startDate && endDate ? countWorkingDays(startDate, endDate, workingDays) : 0;

  const handleApply = async () => {
    if (!leaveCategory || !startDate || (leaveCategory !== "half_day" && !endDate)) { toast.error("Fill all required fields"); return; }
    
    const finalEndDate = leaveCategory === "half_day" ? startDate : endDate;
    const finalDaysCount = leaveCategory === "half_day" ? 0 : workingDaysCount;

    // Prevent non-working day selection
    const sDay = new Date(startDate + "T00:00:00").getDay();
    const eDay = new Date(finalEndDate + "T00:00:00").getDay();
    const isNonWorkingDay = (d: number) => d === 0 || (workingDays === 5 && d === 6);
    if (isNonWorkingDay(sDay) || isNonWorkingDay(eDay)) {
      toast.error(workingDays === 5 ? "Date cannot be on Saturday or Sunday." : "Date cannot be on Sunday.");
      return;
    }
    if (startDate < today) { toast.error("Start date cannot be in the past"); return; }
    if (finalEndDate < startDate) { toast.error("End date must be on or after start date"); return; }
    
    if (leaveCategory === "half_day") {
      if (!leaveHours.trim()) {
        toast.error("Please enter the number of hours");
        return;
      }
      const hoursNum = parseFloat(leaveHours);
      if (isNaN(hoursNum) || hoursNum <= 0) {
        toast.error("Hours requested must be greater than zero");
        return;
      }
      const currentMaxHours = calculateMaxLeaveHours(startDate);
      if (hoursNum > currentMaxHours) {
        toast.error(`You cannot take more hours than your remaining shift hours. You have ${currentMaxHours} hours remaining`);
        return;
      }
    }

    if (isExhausted) { toast.error("You have exhausted your annual leave balance."); return; }
    if (finalDaysCount > remainingDays) { toast.error(`Insufficient balance. You have ${remainingDays} days remaining.`); return; }

    // Check for overlapping leave requests (pending or approved) in the same date range
    const { data: overlapping } = await supabase
      .from("leave_requests")
      .select("id, status, start_date, end_date")
      .eq("user_id", user!.id)
      .in("status", ["pending", "approved"])
      .lte("start_date", finalEndDate)
      .gte("end_date", startDate);
    if (overlapping && overlapping.length > 0) {
      toast.error("You have already applied for leave on this date");
      return;
    }

    const categoryLabel = LEAVE_CATEGORIES.find(c => c.value === leaveCategory)?.label;
    const { data: leaveTypes } = await supabase.from("leave_types").select("id").ilike("name", `%${categoryLabel}%`).limit(1);
    const leaveType = leaveTypes?.[0] ?? null;
    const finalReason = leaveCategory === "other"
      ? `${LEAVE_CATEGORIES.find(c => c.value === leaveCategory)?.label}: ${otherReason}`
      : `${LEAVE_CATEGORIES.find(c => c.value === leaveCategory)?.label}${reason ? ` - ${reason}` : ""}`;

    setSubmitting(true);
    try {
      const { data: newRequest, error } = await supabase.from("leave_requests").insert({
        user_id: user!.id,
        leave_type_id: leaveType?.id || null,
        start_date: startDate,
        end_date: finalEndDate,
        days_count: finalDaysCount,
        hours: leaveCategory === "half_day" ? parseInt(leaveHours, 10) : null,
        reason: finalReason || null,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "leave.requested", target_entity: "leave_requests" });
      
      supabase.functions.invoke("send-request-notification", {
        body: { type: "leave", action: "new", request_id: newRequest.id, app_url: window.location.origin },
      }).catch(() => {});
      
      toast.success("Leave request submitted");
      setApplyOpen(false);
      setLeaveCategory(""); setStartDate(""); setEndDate(""); setReason(""); setOtherReason(""); setLeaveHours("");
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["my-used-leave-days"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const deleteRequest = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { data, error } = await supabase.from("leave_requests").delete().eq("id", deleteId).select();
    setDeleting(false);
    if (error) {
      toast.error(error.message);
    } else if (!data || data.length === 0) {
      toast.error("Could not delete leave request. It may have already been removed or you don't have permission.");
    } else {
      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "leave.deleted", target_entity: "leave_requests", target_id: deleteId });
      toast.success("Leave request deleted");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["my-used-leave-days"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { pending: "bg-yellow-100 text-yellow-800", approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-500" };
    return <Badge className={`${map[status] || ""} capitalize`}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leave & Requests</h1>
      </div>

      <Tabs defaultValue="leave" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="wfh">Work From Home</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-6 mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">My Leave</h2>
            <Button onClick={() => setApplyOpen(true)} disabled={isExhausted} className="rounded-button">
              <Plus className="h-4 w-4 mr-2" />Apply for Leave
            </Button>
          </div>

          <Card className="p-4">
        <p className="text-sm font-medium">Annual Leaves</p>
        <p className="text-xs text-muted-foreground mt-0.5">{currentLeaveYear.label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-2xl font-bold ${remainingDays <= 2 ? "text-destructive" : "text-foreground"}`}>{remainingDays}</span>
          <span className="text-sm text-muted-foreground">/ {totalDays} days remaining</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{usedDays} used</p>
        {halfDayHours > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{halfDayHours} hour{halfDayHours !== 1 ? "s" : ""} of half day leave used this year</p>
        )}
        {usedDays >= totalDays && (
          <p className="text-sm text-destructive mt-2 font-medium">
            Your leave limit for this leave year has been reached. Please contact the admin.
          </p>
        )}
      </Card>

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
        <Select value={String(historyYear)} onValueChange={(v) => setHistoryYear(Number(v))}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {getLeaveYearOptions().map((y) => (
              <SelectItem key={y.startYear} value={String(y.startYear)}>{y.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Admin Comment</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
            ) : filteredRequests.map((r: any) => (
              <>
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                  <TableCell>{expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-medium">
                    {r.hours 
                      ? `Hourly Leave — ${r.hours} hours` 
                      : (r.reason?.split(":")[0]?.split(" - ")[0] || r.leave_types?.name || "Annual")}
                  </TableCell>
                  <TableCell>{format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.hours ? `${r.hours} hrs` : r.days_count}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{r.reason || "—"}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.admin_comment || "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {expandedId === r.id && (
                  <TableRow key={`${r.id}-detail`}>
                    <TableCell colSpan={9} className="bg-muted/50 p-0">
                      <div className="p-4">
                        <div className="mb-3">
                          <p className="text-[12px] text-muted-foreground mb-0.5">Reason / Notes</p>
                          <p className="text-sm">{r.reason || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[12px] text-muted-foreground mb-0.5">Admin Comment</p>
                          <p className="text-sm">{r.admin_comment || "—"}</p>
                        </div>
                        {r.reviewed_at && (
                          <p className="text-xs text-muted-foreground mt-2">Reviewed by {r.users?.full_name || r.reviewed_by || "—"} on {format(new Date(r.reviewed_at), "MMM d, yyyy 'at' h:mm a")}</p>
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
      
      <TabsContent value="wfh" className="space-y-6 mt-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Work From Home</h2>
        </div>

        <Card className="p-6">
          <form onSubmit={handleWfhSubmit} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wfhStartDate">From Date <span className="text-destructive">*</span></Label>
                <Input
                  id="wfhStartDate"
                  type="date"
                  value={wfhStartDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) { setWfhStartDate(v); return; }
                    if (v <= today) { toast.error("Start date must be a future date (tomorrow or later)"); return; }
                    const d = new Date(v + "T00:00:00");
                    const day = d.getDay();
                    if (day === 0 || (day === 6 && workingDays === 5)) { toast.error(workingDays === 5 ? "Date cannot be on Saturday or Sunday" : "Date cannot be on Sunday"); return; }
                    setWfhStartDate(v);
                  }}
                  min={tomorrow}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wfhEndDate">To Date <span className="text-destructive">*</span></Label>
                <Input
                  id="wfhEndDate"
                  type="date"
                  value={wfhEndDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) { setWfhEndDate(v); return; }
                    if (v <= today) { toast.error("End date must be a future date (tomorrow or later)"); return; }
                    const d = new Date(v + "T00:00:00");
                    const day = d.getDay();
                    if (day === 0 || (day === 6 && workingDays === 5)) { toast.error(workingDays === 5 ? "Date cannot be on Saturday or Sunday" : "Date cannot be on Sunday"); return; }
                    setWfhEndDate(v);
                  }}
                  min={wfhStartDate || tomorrow}
                />
              </div>
            </div>
            {wfhStartDate && wfhEndDate && (
              <p className="text-sm text-muted-foreground">
                {countWorkingDays(wfhStartDate, wfhEndDate, workingDays)} working day(s)
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="wfhReason">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="wfhReason"
                value={wfhReason}
                onChange={(e) => setWfhReason(e.target.value)}
                placeholder="Why are you requesting to work from home?"
                rows={3}
              />
            </div>
            <Button type="submit" disabled={wfhSubmitting}>
              {wfhSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Range</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wfhRequests.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No Work From Home requests</TableCell></TableRow>
              ) : wfhRequests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.start_date === r.end_date ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy") : `${format(new Date(r.start_date + "T00:00:00"), "MMM d")} – ${format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}`}</TableCell>
                  <TableCell className="text-center">{r.days_count ?? 1}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{r.reason}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.reviewed_at ? (
                      <>
                        {format(new Date(r.reviewed_at), "MMM d, yyyy")}
                        <br />
                        <span className="text-xs">by {r.users?.full_name || "Admin"}</span>
                      </>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          {isExhausted ? (
            <p className="text-sm text-destructive font-medium py-4">
              Your leave limit for this leave year has been reached. Please contact the admin.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Leave Type <span className="text-destructive">*</span></Label>
                <Select value={leaveCategory} onValueChange={setLeaveCategory}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {leaveCategory === "other" && (
                <div className="space-y-1">
                  <Label>Please specify <span className="text-destructive">*</span></Label>
                  <Input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Reason for leave" />
                </div>
              )}
              {leaveCategory === "half_day" ? (
                <div className="space-y-1">
                  <Label>Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={startDate} onChange={(e) => {
                    const v = e.target.value;
                    if (!v) { setStartDate(v); setEndDate(v); return; }
                    const d = new Date(v + "T00:00:00");
                    const day = d.getDay();
                    if (day === 0 || (day === 6 && workingDays === 5)) { toast.error(workingDays === 5 ? "Date cannot be on Saturday or Sunday" : "Date cannot be on Sunday"); setStartDate(""); setEndDate(""); return; }
                    setStartDate(v);
                    setEndDate(v);
                  }} min={today} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Start Date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={startDate} onChange={(e) => {
                      const v = e.target.value;
                      if (!v) { setStartDate(v); return; }
                      const d = new Date(v + "T00:00:00");
                      const day = d.getDay();
                      if (day === 0 || (day === 6 && workingDays === 5)) { toast.error(workingDays === 5 ? "Start date cannot be on Saturday or Sunday" : "Start date cannot be on Sunday"); setStartDate(""); return; }
                      setStartDate(v);
                    }} min={today} />
                  </div>
                  <div className="space-y-1">
                    <Label>End Date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={endDate} onChange={(e) => {
                      const v = e.target.value;
                      if (!v) { setEndDate(v); return; }
                      const d = new Date(v + "T00:00:00");
                      const day = d.getDay();
                      if (day === 0 || (day === 6 && workingDays === 5)) { toast.error(workingDays === 5 ? "End date cannot be on Saturday or Sunday" : "End date cannot be on Sunday"); setEndDate(""); return; }
                      setEndDate(v);
                    }} min={startDate || today} />
                  </div>
                </div>
              )}
              {leaveCategory === "half_day" && (
                <div className="space-y-1">
                  <Label>Hours requested <span className="text-destructive">*</span></Label>
                  <Input 
                    type="number" 
                    value={leaveHours} 
                    onChange={(e) => setLeaveHours(e.target.value)} 
                    placeholder={`Max ${maxLeaveHours} hours`}
                    min="1"
                    max={maxLeaveHours}
                    className={hoursError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {hoursError && (
                    <p className="text-xs text-destructive font-medium">{hoursError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Remaining shift hours for the selected day: {maxLeaveHours} hours
                  </p>
                </div>
              )}
              {leaveCategory === "half_day" ? (
                startDate && (
                  <p className="text-sm text-muted-foreground">Hourly Leave · {remainingDays} days remaining</p>
                )
              ) : (
                workingDaysCount > 0 && (
                  <p className="text-sm text-muted-foreground">{workingDaysCount} working day{workingDaysCount > 1 ? "s" : ""} · {remainingDays} days remaining</p>
                )
              )}
              <div className="space-y-1">
                <Label>Additional Notes</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            {!isExhausted && (
              <Button onClick={handleApply} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
            )}
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
            <AlertDialogAction onClick={deleteRequest} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
