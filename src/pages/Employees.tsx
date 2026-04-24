import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Upload, Eye, Save, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { CSVImportDialog } from "@/components/employees/CSVImportDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatTime12h } from "@/hooks/useWorkSettings";
import { toast } from "sonner";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Management", "Sales", "Other"];
const STATUSES = ["active", "inactive", "pending"];
const EMP_TYPES = ["full-time", "part-time", "contract"];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [csvOpen, setCsvOpen] = useState(false);
  const queryClient = useQueryClient();
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Shift Settings State
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [gracePeriod, setGracePeriod] = useState("");
  const [reminderOffset, setReminderOffset] = useState("");
  const [leaveEntitlement, setLeaveEntitlement] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  useMemo(() => {
    if (settings) {
      setShiftStart(settings["default_shift_start"] ?? "");
      setShiftEnd(settings["default_shift_end"] ?? "");
      setGracePeriod(settings["late_grace_minutes"] ?? "15");
      setReminderOffset(settings["reminder_offset_minutes"] ?? "30");
      setLeaveEntitlement(settings["annual_leave_entitlement"] ?? "12");
    }
  }, [settings]);

  const handleSaveGlobalSettings = async () => {
    setSavingSettings(true);
    try {
      const entries = [
        { key: "default_shift_start", value: shiftStart },
        { key: "default_shift_end", value: shiftEnd },
        { key: "late_grace_minutes", value: gracePeriod },
        { key: "reminder_offset_minutes", value: reminderOffset },
        { key: "annual_leave_entitlement", value: leaveEntitlement },
      ];
      for (const entry of entries) {
        await supabase.from("system_settings").upsert(
          { ...entry, updated_by: profile?.id },
          { onConflict: "key" }
        );
      }
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.global_shift_updated",
        target_entity: "system_settings",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings-global"] });
      toast.success("Global shift settings saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingSettings(false); }
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch = !q || e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || e.department === deptFilter;
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchType = typeFilter === "all" || e.employment_type === typeFilter;
      return matchSearch && matchDept && matchStatus && matchType;
    });
  }, [employees, search, deptFilter, statusFilter, typeFilter]);

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-500",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={`${variants[status] || ""} capitalize font-medium`}>{status}</Badge>;
  };

  const getAvatarUrl = (avatarUrl: string | null) => {
    if (!avatarUrl) return undefined;
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">{employees.length} total employees</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => navigate("/employees/new")} className="rounded-button">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All Employees</TabsTrigger>
          {isAdmin && <TabsTrigger value="shift">Global Shift Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, designation…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="border border-border rounded-card bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                ) : (
                  filtered.map((emp) => {
                    const initials = emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <TableRow key={emp.id} className="cursor-pointer" onClick={() => navigate(`/employees/${emp.id}`)}>
                        <TableCell>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getAvatarUrl(emp.avatar_url)} />
                            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                        <TableCell>{emp.designation}</TableCell>
                        <TableCell>{emp.employment_type}</TableCell>
                        <TableCell>{statusBadge(emp.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.id}`); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingUser(emp); }} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <Dialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete user — {deletingUser?.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-destructive font-medium">Warning: This will permanently delete the user account and all related data (attendance, logs, leave requests, notifications, balances, etc.). This action cannot be undone.</p>
                <p className="text-sm">Are you sure you want to delete <strong>{deletingUser?.full_name}</strong> ({deletingUser?.email})?</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancel</Button>
                <Button className="bg-destructive text-destructive-foreground" onClick={async () => {
                  console.log("Deleting user", deletingUser);
                  if (!deletingUser) return;
                  if (deletingUser.id === profile?.id) { toast.error("You cannot delete your own account."); return; }
                  setDeleting(true);
                  try {
                    const res = await supabase.functions.invoke("manage-user", { body: { action: "delete", user_id: deletingUser.id } }) as any;
                    console.log("Delete response", res);
                    if (res?.data?.ok) {
                      toast.success("User and related data deleted");
                      queryClient.invalidateQueries({ queryKey: ["employees"] });
                      setDeletingUser(null);
                    } else {
                      console.log("Delete error", res);
                      toast.error(res?.data?.error || res?.error?.message || "Failed to delete user");
                    }
                  } catch (err: any) {
                    console.log("Delete error", err);
                    toast.error(err?.message || String(err));
                  } finally { setDeleting(false); }
                }} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="shift" className="mt-6">
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Global Shift & Leave Settings</h3>
                  <p className="text-sm text-muted-foreground">Used for employees who do not have a custom shift override.</p>
                </div>
                <Button onClick={handleSaveGlobalSettings} disabled={savingSettings} className="rounded-button">
                  <Save className="h-4 w-4 mr-2" />{savingSettings ? "Saving…" : "Save Settings"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-black font-medium border-b pb-2">
                    <Clock className="h-4 w-4" />
                    <h4>Shift Times</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Default Shift Start</Label>
                      <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                      <p className="text-[11px] text-muted-foreground">Currently: {formatTime12h(shiftStart)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default Shift End</Label>
                      <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
                      <p className="text-[11px] text-muted-foreground">Currently: {formatTime12h(shiftEnd)}</p>
                    </div>

                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-black font-medium border-b pb-2">
                    <Save className="h-4 w-4" />
                    <h4>Policy Thresholds</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Late Grace Period (min)</Label>
                      <Input type="number" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default Reminder (min)</Label>
                      <Input type="number" value={reminderOffset} onChange={(e) => setReminderOffset(e.target.value)} />
                    </div>

                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <CSVImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}
