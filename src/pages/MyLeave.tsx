import { useState } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { format, differenceInBusinessDays } from "date-fns";

const LEAVE_CATEGORIES = [
  { value: "sick", label: "Sick Leave" },
  { value: "personal", label: "Personal Leave" },
  { value: "bereavement", label: "Bereavement" },
  { value: "casual", label: "Casual Leave" },
  { value: "other", label: "Other" },
];

export default function MyLeavePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const today = new Date().toISOString().split("T")[0];

  // Live global entitlement from system_settings
  const { data: annualEntitlement = 12 } = useQuery({
    queryKey: ["system-setting-annual-leave"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "annual_leave_entitlement").maybeSingle();
      return data ? Number(data.value) : 12;
    },
    refetchInterval: 30000, // poll every 30s for real-time sync
  });

  // Calculate used days from approved leave requests (live calculation)
  const { data: usedDays = 0 } = useQuery({
    queryKey: ["my-used-leave-days", user?.id],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      const { data } = await supabase
        .from("leave_requests")
        .select("days_count")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .gte("start_date", startOfYear)
        .lte("start_date", endOfYear);
      return (data || []).reduce((sum, r) => sum + r.days_count, 0);
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

  const filteredRequests = statusFilter === "all" ? requests : requests.filter((r: any) => r.status === statusFilter);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const workingDays = startDate && endDate ? Math.max(1, differenceInBusinessDays(new Date(endDate), new Date(startDate)) + 1) : 0;

  const handleApply = async () => {
    if (!leaveCategory || !startDate || !endDate) { toast.error("Fill all required fields"); return; }
    // Prevent weekend selection (Saturday=6, Sunday=0)
    const sDay = new Date(startDate + "T00:00:00").getDay();
    const eDay = new Date(endDate + "T00:00:00").getDay();
    if (sDay === 6 || sDay === 0 || eDay === 6 || eDay === 0) {
      toast.error("Start/End date cannot be on Saturday or Sunday. Please choose working days.");
      return;
    }
    if (startDate < today) { toast.error("Start date cannot be in the past"); return; }
    if (endDate < startDate) { toast.error("End date must be on or after start date"); return; }
    if (isExhausted) { toast.error("You have exhausted your annual leave balance."); return; }
    if (workingDays > remainingDays) { toast.error(`Insufficient balance. You have ${remainingDays} days remaining.`); return; }

    const leaveTypes = (await supabase.from("leave_types").select("id").limit(1)).data;
    const leaveType = leaveTypes && leaveTypes.length > 0 ? leaveTypes[0] : null;
    const finalReason = leaveCategory === "other"
      ? `${LEAVE_CATEGORIES.find(c => c.value === leaveCategory)?.label}: ${otherReason}`
      : `${LEAVE_CATEGORIES.find(c => c.value === leaveCategory)?.label}${reason ? ` - ${reason}` : ""}`;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        user_id: user!.id,
        leave_type_id: leaveType?.id || null,
        start_date: startDate,
        end_date: endDate,
        days_count: workingDays,
        reason: finalReason || null,
        status: "pending",
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "leave.requested", target_entity: "leave_requests" });
      toast.success("Leave request submitted");
      setApplyOpen(false);
      setLeaveCategory(""); setStartDate(""); setEndDate(""); setReason(""); setOtherReason("");
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-used-leave-days"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const deleteRequest = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("leave_requests").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "leave.deleted", target_entity: "leave_requests", target_id: deleteId });
      toast.success("Leave request deleted");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
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
        <h1 className="text-2xl font-bold tracking-tight">My Leave</h1>
        <Button onClick={() => setApplyOpen(true)} disabled={isExhausted} className="rounded-button">
          <Plus className="h-4 w-4 mr-2" />Apply for Leave
        </Button>
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium">Annual Leaves</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-2xl font-bold ${remainingDays <= 2 ? "text-destructive" : "text-foreground"}`}>{remainingDays}</span>
          <span className="text-sm text-muted-foreground">/ {totalDays} days remaining</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{usedDays} used</p>
        {isExhausted && (
          <p className="text-sm text-destructive mt-2 font-medium">
            You have exhausted your annual leave balance. No further leave applications can be submitted.
          </p>
        )}
      </Card>

      <div className="flex gap-3">
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
                  <TableCell className="font-medium">{r.reason?.split(":")[0]?.split(" - ")[0] || r.leave_types?.name || "Annual"}</TableCell>
                  <TableCell>{format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.days_count}</TableCell>
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

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          {isExhausted ? (
            <p className="text-sm text-destructive font-medium py-4">
              You have exhausted your annual leave balance. No further leave applications can be submitted.
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={startDate} onChange={(e) => {
                    const v = e.target.value;
                    if (!v) { setStartDate(v); return; }
                    const d = new Date(v + "T00:00:00");
                    const day = d.getDay(); // 0=Sun .. 6=Sat
                    if (day === 6 || day === 0) { toast.error("Start date cannot be on Saturday or Sunday"); setStartDate(""); return; }
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
                    if (day === 6 || day === 0) { toast.error("End date cannot be on Saturday or Sunday"); setEndDate(""); return; }
                    setEndDate(v);
                  }} min={startDate || today} />
                </div>
              </div>
              {workingDays > 0 && (
                <p className="text-sm text-muted-foreground">{workingDays} working day{workingDays > 1 ? "s" : ""} · {remainingDays} days remaining</p>
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
