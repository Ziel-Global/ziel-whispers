import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend } from "date-fns";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Other"];

export default function LeaveAdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [deptFilter, setDeptFilter] = useState("all");
  const [actionModal, setActionModal] = useState<{ type: "approve" | "reject"; request: any } | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  const { data: requests = [] } = useQuery({
    queryKey: ["admin-leave-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, leave_types(name), users!leave_requests_user_id_fkey(full_name, department, email)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return requests.filter((r: any) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchDept = deptFilter === "all" || r.users?.department === deptFilter;
      return matchStatus && matchDept;
    });
  }, [requests, statusFilter, deptFilter]);

  const handleAction = async () => {
    if (!actionModal) return;
    const { type, request } = actionModal;
    if (type === "reject" && !adminComment.trim()) { toast.error("Rejection reason is required"); return; }

    setProcessing(true);
    try {
      const { error } = await supabase.from("leave_requests").update({
        status: type === "approve" ? "approved" : "rejected",
        admin_comment: adminComment || null,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      if (error) throw error;

      // Deduct balance if approved
      if (type === "approve") {
        const { data: balance } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("user_id", request.user_id)
          .eq("leave_type_id", request.leave_type_id)
          .eq("year", new Date().getFullYear())
          .single();

        if (balance) {
          await supabase.from("leave_balances")
            .update({ used_days: balance.used_days + request.days_count })
            .eq("id", balance.id);
        }
      }

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: type === "approve" ? "leave.approved" : "leave.rejected",
        target_entity: "leave_requests",
        target_id: request.id,
      });

      // Notification
      await supabase.from("notifications").insert({
        user_id: request.user_id,
        type: `leave.${type === "approve" ? "approved" : "rejected"}`,
        metadata: { leave_type: request.leave_types?.name, days: request.days_count },
      });

      toast.success(`Leave request ${type}d`);
      setActionModal(null);
      setAdminComment("");
      queryClient.invalidateQueries({ queryKey: ["admin-leave-requests"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setProcessing(false); }
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

  // Calendar data
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const approvedRequests = requests.filter((r: any) => r.status === "approved");
  const getLeavesForDay = (d: Date) => {
    const ds = format(d, "yyyy-MM-dd");
    return approvedRequests.filter((r: any) => r.start_date <= ds && r.end_date >= ds);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No requests</TableCell></TableRow>
                ) : (
                  filtered.map((r: any) => (
                    <TableRow key={r.id} className={r.status === "pending" ? "bg-yellow-50/50" : ""}>
                      <TableCell className="font-medium">{r.users?.full_name}</TableCell>
                      <TableCell>{r.leave_types?.name}</TableCell>
                      <TableCell>{format(new Date(r.start_date + "T00:00:00"), "MMM d")}</TableCell>
                      <TableCell>{format(new Date(r.end_date + "T00:00:00"), "MMM d")}</TableCell>
                      <TableCell>{r.days_count}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{r.reason || "—"}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d")}</TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setActionModal({ type: "approve", request: r })} className="text-green-600"><Check className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setActionModal({ type: "reject", request: r })} className="text-destructive"><X className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
                  <div key={d.toISOString()} className={`min-h-[60px] p-1 rounded text-xs border ${isWeekend(d) ? "bg-muted" : "bg-card"}`}>
                    <span className="font-medium">{d.getDate()}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {leaves.slice(0, 2).map((l: any) => {
                        const initials = l.users?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                        return (
                          <div key={l.id} className="flex items-center gap-1" title={`${l.users?.full_name} - ${l.leave_types?.name}`}>
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-primary/10">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{l.users?.full_name?.split(" ")[0]}</span>
                          </div>
                        );
                      })}
                      {leaves.length > 2 && <span className="text-muted-foreground">+{leaves.length - 2}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Modal */}
      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionModal?.type === "approve" ? "Approve" : "Reject"} Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{actionModal?.request?.users?.full_name}</strong> — {actionModal?.request?.leave_types?.name} ({actionModal?.request?.days_count} days)
            </p>
            <div className="space-y-1">
              <Label>{actionModal?.type === "reject" ? "Rejection Reason *" : "Comment (optional)"}</Label>
              <Textarea value={adminComment} onChange={(e) => setAdminComment(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={actionModal?.type === "approve" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {processing ? "Processing…" : actionModal?.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
