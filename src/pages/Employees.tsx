import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Upload, Eye, Save, Clock, Trash2, Bell } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { CSVImportDialog } from "@/components/employees/CSVImportDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatTime12h } from "@/hooks/useWorkSettings";
import { toast } from "sonner";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];
const STATUSES = ["active", "inactive", "pending"];
const EMP_TYPES = ["full-time", "part-time", "contract"];

import { getAvatarUrl, cn } from "@/lib/utils";

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
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

  useEffect(() => {
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
      const matchRole = roleFilter === "all" || e.role === roleFilter;
      return matchSearch && matchDept && matchStatus && matchType && matchRole;
    });
  }, [employees, search, deptFilter, statusFilter, typeFilter, roleFilter]);

  const getFilterTriggerClasses = (isActive: boolean) => cn(
    "h-10 text-[13px] font-medium text-[#09090B] shadow-sm transition-colors outline-none",
    "hover:border-[#EC6824] hover:bg-[#FFF4EA]",
    "focus:border-[#EC6824] focus:ring-[3px] focus:ring-[#EC6824]/20 focus:ring-offset-0",
    "data-[state=open]:border-[#EC6824] data-[state=open]:ring-[3px] data-[state=open]:ring-[#EC6824]/20",
    isActive ? "border-[#EC6824] bg-[#FFF4EA]" : "border-[#E4E4E7] bg-white"
  );

  const filterItemClasses = "focus:bg-[#FFEDD5] focus:text-[#09090B] data-[state=checked]:bg-[#FFF4EA] data-[state=checked]:text-[#09090B] [&[data-state=checked]_svg]:text-[#EC6824] cursor-pointer transition-colors";

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-bold text-[#09090B] tracking-tight leading-none mb-2">Users</h1>
          <p className="text-[13px] text-[#71717A] font-medium">{employees.length} total users</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="rounded-full border-[#E4E4E7] h-10 w-10 text-[#71717A]">
              <Bell className="h-[18px] w-[18px]" />
            </Button>
            <Avatar className="h-10 w-10 bg-[#EC6824]/10 text-[#EC6824] font-bold text-[13px] flex items-center justify-center rounded-full border border-[#EC6824]/20">
              {profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "BF"}
            </Avatar>
            <Button variant="outline" onClick={() => setCsvOpen(true)} className="rounded-md border-[#E4E4E7] text-[#09090B] font-semibold h-10 px-5 ml-2 shadow-sm">
              <Upload className="h-4 w-4 mr-2 text-[#71717A]" />
              Import CSV
            </Button>
            <Button onClick={() => navigate("/employees/new")} className="rounded-md bg-[#EC6824] hover:bg-[#EC6824]/90 text-white font-semibold h-10 px-6 shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add New User
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="inline-flex items-center bg-white border border-[#E4E4E7] rounded-md p-[6px] gap-1 mb-8 shadow-sm">
          <TabsTrigger
            value="list"
            className="rounded-md px-5 py-2 text-[13px] font-semibold transition-all duration-200 data-[state=active]:bg-[#1C1C1E] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#6B7280] hover:data-[state=inactive]:bg-[#F4F4F5]"
          >
            All Users
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="shift"
              className="rounded-md px-5 py-2 text-[13px] font-semibold transition-all duration-200 data-[state=active]:bg-[#1C1C1E] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#6B7280] hover:data-[state=inactive]:bg-[#F4F4F5]"
            >
              Global Shift Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="mt-0">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 max-w-[480px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
              <Input type="text" placeholder="Search by name, email, designation…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-md border-[#E4E4E7] bg-white h-10 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] shadow-sm focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824]" />
            </div>

            <div className="flex-1"></div>

            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className={cn("w-[170px]", getFilterTriggerClasses(deptFilter !== "all"))}><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className={filterItemClasses}>All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d} className={filterItemClasses}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={cn("w-[140px]", getFilterTriggerClasses(statusFilter !== "all"))}><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className={filterItemClasses}>All Status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className={cn(filterItemClasses, "capitalize")}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={cn("w-[140px]", getFilterTriggerClasses(typeFilter !== "all"))}><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className={filterItemClasses}>All Types</SelectItem>
                {EMP_TYPES.map((t) => <SelectItem key={t} value={t} className={cn(filterItemClasses, "capitalize")}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className={cn("w-[140px]", getFilterTriggerClasses(roleFilter !== "all"))}><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className={filterItemClasses}>All Roles</SelectItem>
                <SelectItem value="admin" className={filterItemClasses}>Admin</SelectItem>
                <SelectItem value="manager" className={filterItemClasses}>Manager</SelectItem>
                <SelectItem value="employee" className={filterItemClasses}>Employee</SelectItem>
                <SelectItem value="client member" className={filterItemClasses}>Client Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border border-[#E4E4E7] rounded-[16px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            {isLoading ? (
              <div className="px-4 py-12 text-center text-[#71717A] text-[13px]">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-[#71717A] text-[13px]">No employees found</div>
            ) : (
              <div>
                <div className="px-6 py-3 border-b border-[#E4E4E7] grid gap-4 items-center text-[10px] font-bold text-[#A1A1AA] tracking-wider uppercase bg-transparent"
                  style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 100px 120px 80px" }}>
                  <span>EMPLOYEE</span>
                  <span>EMAIL</span>
                  <span>PHONE</span>
                  <span>STATUS</span>
                  <span>JOIN DATE</span>
                  <span className="text-right">ACTIONS</span>
                </div>
                <div className="flex flex-col bg-white">
                  {filtered.map((emp, index) => {
                    const initials = emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    const isOversight = emp.is_oversight;
                    // Normal rows are white, selected/oversight rows are soft peach
                    const rowBg = isOversight ? "bg-[#FFF4EA]" : "bg-white";

                    const colorClasses = [
                      "bg-[#DCFCE7] text-[#166534]", // Green
                      "bg-[#DBEAFE] text-[#1E40AF]", // Blue
                      "bg-[#FFEDD5] text-[#9A3412]", // Orange
                      "bg-[#F4F4F5] text-[#71717A]"  // Gray
                    ];
                    const avatarColorClass = colorClasses[index % colorClasses.length];

                    return (
                      <div key={emp.id} className={cn("px-6 py-4 border-b border-[#F4F4F5] last:border-b-0 grid gap-4 items-center hover:bg-[#FFF1E6] transition-colors cursor-pointer", rowBg)}
                        style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 100px 120px 80px" }}
                        onClick={() => navigate(`/employees/${emp.id}`)}>
                        <div className="flex items-center gap-3">
                          <Avatar className={`h-9 w-9 shrink-0 ${avatarColorClass}`}>
                            <AvatarImage src={getAvatarUrl(emp.avatar_url)} />
                            <AvatarFallback className="bg-transparent text-inherit text-[13px] font-bold tracking-tight">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-[#18181B] truncate tracking-tight">{emp.full_name}</p>
                            <p className="text-[12px] text-[#71717A] truncate mt-0.5">{emp.designation}{emp.department ? ` - ${emp.department}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-[13.5px] text-[#52525B] truncate">{emp.email}</div>
                        <div className="text-[13.5px] text-[#52525B] truncate">{emp.phone || '—'}</div>
                        <div>
                          <Badge className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent", emp.status === 'active' ? 'bg-[#DCFCE7] text-[#166534]' : emp.status === 'inactive' ? 'bg-[#F4F4F5] text-[#71717A]' : 'bg-yellow-100 text-yellow-800')}>
                            {emp.status}
                          </Badge>
                        </div>
                        <div className="text-[13.5px] text-[#52525B] truncate">{emp.join_date ? format(new Date(emp.join_date), "MMM d, yyyy") : '—'}</div>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FFF4EA] text-[#EC6824] hover:bg-[#FFEDD5] transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.id}`); }}>
                            <Eye className="h-[15px] w-[15px]" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FEF2F2] text-[#EF4444] hover:bg-[#FEE2E2] transition-colors" onClick={(e) => { e.stopPropagation(); setDeletingUser(emp); }}>
                              <Trash2 className="h-[15px] w-[15px]" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                  if (!deletingUser) return;
                  if (deletingUser.id === profile?.id) { toast.error("You cannot delete your own account."); return; }
                  setDeleting(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await supabase.functions.invoke("manage-user", {
                      body: { action: "delete", user_id: deletingUser.id },
                      headers: { Authorization: `Bearer ${session?.access_token}` },
                    }) as any;
                    if (res?.data?.ok) {
                      toast.success("User and related data deleted");
                      queryClient.invalidateQueries({ queryKey: ["employees"] });
                      setDeletingUser(null);
                    } else {
                      toast.error(res?.data?.error || res?.error?.message || "Failed to delete user");
                    }
                  } catch (err: any) {
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
