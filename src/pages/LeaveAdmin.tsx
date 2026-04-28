import { useState, useMemo, useEffect } from "react";
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
import { Check, X, ChevronLeft, ChevronRight, Save, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend } from "date-fns";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];
const LEAVE_CATEGORIES = ["Sick Leave", "Personal Leave", "Bereavement", "Casual Leave", "Other"];

export default function LeaveAdminPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [actionModal, setActionModal] = useState<{ type: "approve" | "reject"; request: any } | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

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

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAction = async () => {
    if (!actionModal) return;
    const { type, request } = actionModal;
    if (type === "reject" && !adminComment.trim()) { toast.error("Rejection reason is required"); return; }

    // Check entitlement on approval
    if (type === "approve") {
      const year = new Date().getFullYear();
      const entitlementVal = Number(annualEntitlement) || 12;
      const { data: approvedReqs } = await supabase
        .from("leave_requests")
        .select("days_count")
        .eq("user_id", request.user_id)
        .eq("status", "approved")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`);
      const usedDays = (approvedReqs || []).reduce((s: number, r: any) => s + r.days_count, 0);
      if (usedDays + request.days_count > entitlementVal) {
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
        metadata: { employee: request.users?.full_name, days: request.days_count, leave_type: request.leave_types?.name },
      });

      await supabase.from("notifications").insert({
        user_id: request.user_id,
        type: `leave.${newStatus}`,
        metadata: { leave_type: request.leave_types?.name, days: request.days_count },
      });

      toast.success(`Leave request ${type}d`);
      setActionModal(null);
      setAdminComment("");
      queryClient.invalidateQueries({ queryKey: ["admin-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
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
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="settings">Leave Settings</TabsTrigger>
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
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No requests</TableCell></TableRow>
                ) : filtered.map((r: any) => (
                  <>
                    <TableRow key={r.id} className={`cursor-pointer ${r.status === "pending" ? "bg-yellow-50/50" : ""}`} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      <TableCell>{expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">{r.users?.full_name}</TableCell>
                      <TableCell>{r.leave_types?.name}</TableCell>
                      <TableCell>{format(new Date(r.start_date + "T00:00:00"), "MMM d")}</TableCell>
                      <TableCell>{format(new Date(r.end_date + "T00:00:00"), "MMM d")}</TableCell>
                      <TableCell>{r.days_count}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{r.reason || "—"}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 items-center">
                          {r.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setActionModal({ type: "approve", request: r }); }} className="text-green-600"><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setActionModal({ type: "reject", request: r }); }} className="text-destructive"><X className="h-4 w-4" /></Button>
                            </>
                          )}
                          {r.status !== "pending" && r.admin_comment && (
                            <span className="text-xs text-muted-foreground mr-2" title={r.admin_comment}>💬</span>
                          )}
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === r.id && (
                      <TableRow key={`${r.id}-detail`}>
                        <TableCell colSpan={10} className="bg-muted/50 p-0">
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Employee</p>
                                <p className="text-sm font-medium">{r.users?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{r.users?.department} · {r.users?.email}</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Dates</p>
                                <p className="text-sm">{format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")} — {format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}</p>
                                <p className="text-xs text-muted-foreground">{r.days_count} day(s)</p>
                              </div>
                              <div>
                                <p className="text-[12px] text-muted-foreground mb-0.5">Submitted</p>
                                <p className="text-sm">{format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                              </div>
                            </div>
                            <div className="mb-3">
                              <p className="text-[12px] text-muted-foreground mb-0.5">Reason / Notes</p>
                              <p className="text-sm">{r.reason || "—"}</p>
                            </div>
                            {r.admin_comment && (
                              <div className="mb-2">
                                <p className="text-[12px] text-muted-foreground mb-0.5">Admin Comment</p>
                                <p className="text-sm">{r.admin_comment}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {r.status === "pending" && (
                                <>
                                  <Button size="sm" onClick={async (e) => { e.stopPropagation(); setActionModal({ type: "approve", request: r }); }}>Approve</Button>
                                  <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setActionModal({ type: "reject", request: r }); }}>Reject</Button>
                                </>
                              )}
                            </div>
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
                          <div key={l.id} className="flex items-center gap-1" title={`${l.users?.full_name} - ${l.leave_types?.name}`}>
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
                          <p className="text-xs text-muted-foreground">{l.leave_types?.name} · {l.days_count} day(s)</p>
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
    </div>
  );
}
