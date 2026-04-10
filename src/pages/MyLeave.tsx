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
import { Plus } from "lucide-react";
import { format, differenceInBusinessDays } from "date-fns";

export default function MyLeavePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("*").order("name");
      return data || [];
    },
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["my-leave-balances", user?.id],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name)")
        .eq("user_id", user!.id)
        .eq("year", year);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["my-leave-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, leave_types(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const workingDays = startDate && endDate
    ? Math.max(1, differenceInBusinessDays(new Date(endDate), new Date(startDate)) + 1)
    : 0;

  const handleApply = async () => {
    if (!leaveTypeId || !startDate || !endDate) { toast.error("Fill all required fields"); return; }
    // Check balance
    const balance = balances.find((b: any) => b.leave_type_id === leaveTypeId);
    const remaining = balance ? balance.total_days - balance.used_days : 0;
    if (workingDays > remaining) { toast.error(`Insufficient balance. You have ${remaining} days remaining.`); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        user_id: user!.id,
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        days_count: workingDays,
        reason: reason || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Leave request submitted");
      setApplyOpen(false);
      setLeaveTypeId(""); setStartDate(""); setEndDate(""); setReason("");
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const cancelRequest = async (id: string) => {
    await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
    toast.success("Request cancelled");
    queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-700",
      cancelled: "bg-gray-100 text-gray-500",
    };
    return <Badge className={`${map[status] || ""} capitalize`}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
        <Button onClick={() => setApplyOpen(true)} className="rounded-button">
          <Plus className="h-4 w-4 mr-2" />Apply for Leave
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((b: any) => {
          const remaining = b.total_days - b.used_days;
          return (
            <Card key={b.id} className="p-4">
              <p className="text-sm font-medium">{b.leave_types?.name}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold ${remaining <= 2 ? "text-destructive" : "text-foreground"}`}>{remaining}</span>
                <span className="text-sm text-muted-foreground">/ {b.total_days} days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{b.used_days} used</p>
            </Card>
          );
        })}
        {balances.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-4">No leave balances configured. Contact your admin.</p>
        )}
      </div>

      {/* Request History */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin Comment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
            ) : (
              requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.leave_types?.name}</TableCell>
                  <TableCell>{format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                  <TableCell>{r.days_count}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{r.reason || "—"}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.admin_comment || "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelRequest(r.id)}>Cancel</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Apply Modal */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Leave Type *</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt: any) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="space-y-1">
                <Label>End Date *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            {workingDays > 0 && <p className="text-sm text-muted-foreground">{workingDays} working day{workingDays > 1 ? "s" : ""}</p>}
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
