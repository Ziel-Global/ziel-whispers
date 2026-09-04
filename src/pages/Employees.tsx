// Active Users (Employees Page) Component - Fully audited & verified JSX structure
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
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader } from "@/components/ui/data-row";
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

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];
const STATUSES = ["active", "inactive", "pending"];
const EMP_TYPES = ["full-time", "part-time", "contract"];

import { getAvatarUrl } from "@/lib/utils";

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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [bulkDeleteEmployeeOpen, setBulkDeleteEmployeeOpen] = useState(false);

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

  const deleteUserRecord = async (userId: string): Promise<boolean> => {
    // 1. Try fast PostgreSQL RPC execution (executes in ~50ms)
    const { error: rpcErr } = await supabase.rpc("delete_user_complete" as any, { target_user_id: userId });
    if (!rpcErr) return true;

    // 2. Fallback to Edge Function invocation
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("manage-user", {
      body: { action: "delete", user_id: userId },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    }) as any;
    return !!res?.data?.ok;
  };

  const handleBulkDeleteEmployees = async () => {
    const ids = Array.from(selectedEmployeeIds);
    if (!ids.length) return;
    setDeleting(true);
    try {
      let deleted = 0;
      for (const id of ids) {
        if (id === profile?.id) continue;
        const ok = await deleteUserRecord(id);
        if (ok) deleted++;
      }
      if (deleted > 0) toast.success(`${deleted} user${deleted > 1 ? "s" : ""} deleted`);
      setSelectedEmployeeIds(new Set());
      setBulkDeleteEmployeeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) { toast.error(err?.message || String(err)); }
    finally { setDeleting(false); }
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

  const getAvatarColors = (nameOrId: string) => {
    const palette = [
      { bg: "#DFF6E4", color: "#1B8A46" }, // Soft Mint / Emerald
      { bg: "#E6E9FF", color: "#4C57D9" }, // Soft Indigo / Royal Blue
      { bg: "#FDECE3", color: "#EB5A1E" }, // Soft Peach / Brand Orange
      { bg: "#FDF3E3", color: "#A9720B" }, // Soft Amber / Gold
      { bg: "#F6E6FF", color: "#9333EA" }, // Soft Violet
      { bg: "#EAF3FF", color: "#1C6FC9" }, // Soft Sky Blue
    ];
    let hash = 0;
    const str = nameOrId || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-[#DFF6E4] text-[#1B8A46]",
      inactive: "bg-[#F6F5F3] text-[#8B8B92]",
      pending: "bg-[#FDF3E3] text-[#A9720B]",
    };
    return <Badge className={`${variants[status] || "bg-[#F6F5F3] text-[#8B8B92]"} capitalize font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none`}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Users</h1>
          <p className="text-[13.5px] text-[#8B8B92] mt-0.5">{employees.length} total users</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCsvOpen(true)}
              className="flex items-center gap-2 bg-white border border-black/[0.08] rounded-[10px] px-4 py-2 text.5 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-[#4B4B52]" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => navigate("/employees/new")}
              className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white rounded-[10px] px-4 py-2 text.5 text-[13px] font-semibold transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-white" />
              Add New User
            </button>
          </div>
        )}
      </div>

      <Tabs defaultValue="list">
        <TabsList className="bg-white border border-black/[0.08] rounded-[11px] p-[5px] h-auto flex items-center gap-1 w-fit">
          <TabsTrigger
            value="list"
            className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none"
          >
            All Users
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="shift"
              className="rounded-[8px] px-4 py-2 text-[13px] font-medium text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none"
            >
              Global Shift Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-6">
          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="flex-1 min-w-[220px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm">
              <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
              <input
                type="text"
                placeholder="Search by name, email, designation…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-[13px] text-[#17171A] placeholder:text-[#B0B0B6] focus:outline-none font-sans"
              />
            </div>

            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="client member">Client Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-[#8B8B92] text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#8B8B92] text-sm">No employees found</div>
            ) : (
              <div>
                <TableHeader gridCols="40px 2fr 1.7fr 1fr 0.8fr 1fr 0.7fr" className="px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em]">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                      checked={selectedEmployeeIds.size === filtered.length && filtered.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEmployeeIds(new Set(filtered.map((emp) => emp.id)));
                        else setSelectedEmployeeIds(new Set());
                      }}
                    />
                  </div>
                  <span>EMPLOYEE</span>
                  <span>EMAIL</span>
                  <span>PHONE</span>
                  <span>STATUS</span>
                  <span>JOIN DATE</span>
                  <span className="text-right">ACTIONS</span>
                </TableHeader>
                {selectedEmployeeIds.size > 0 && (
                  <div className="flex items-center justify-between px-5 py-2.5 bg-[#17171A] text-white">
                    <span className="text-xs font-semibold">{selectedEmployeeIds.size} user{selectedEmployeeIds.size > 1 ? "s" : ""} selected</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedEmployeeIds(new Set())} className="px-3 py-1 text-xs font-medium text-white/80 hover:text-white border border-white/20 rounded-md bg-transparent">Clear selection</button>
                      <button onClick={() => setBulkDeleteEmployeeOpen(true)} className="px-3 py-1 text-xs bg-[#E5484D] text-white rounded-md hover:bg-red-700 flex items-center gap-1 font-semibold">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete selected
                      </button>
                    </div>
                  </div>
                )}
                {filtered.map((emp) => {
                const initials = emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                const isOversight = emp.is_oversight;
                const avatarStyle = getAvatarColors(emp.full_name || emp.id);
                return (
                  <DataRow
                    key={emp.id}
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className={`px-5 py-3 border-b border-black/[0.05] transition-colors ${isOversight ? "bg-[#fef3c7] hover:bg-[#fef3c7]" : "hover:bg-[#F6F5F3]/50"}`}
                    gridCols="40px 2fr 1.7fr 1fr 0.8fr 1fr 0.7fr"
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                        checked={selectedEmployeeIds.has(emp.id)}
                        onChange={(e) => {
                          const next = new Set(selectedEmployeeIds);
                          if (e.target.checked) next.add(emp.id);
                          else next.delete(emp.id);
                          setSelectedEmployeeIds(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0 font-bold text-[11.5px]" style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.color }}>
                        <AvatarImage src={getAvatarUrl(emp.avatar_url)} />
                        <AvatarFallback className="font-bold text-[11.5px] border-0" style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.color }}>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <RowPrimary className="font-bold text-[13.5px] text-[#17171A] truncate">{emp.full_name}</RowPrimary>
                        <RowSecondary className="text-[12px] text-[#8B8B92] truncate">{emp.role || "Employee"}{emp.department ? ` · ${emp.department}` : ""}</RowSecondary>
                      </div>
                    </div>
                    <RowDataItem label="EMAIL" className="text-[13px] text-[#4B4B52] truncate">{emp.email}</RowDataItem>
                    <RowDataItem label="PHONE" className="text-[13px] text-[#4B4B52]">{emp.phone || "—"}</RowDataItem>
                    <RowBadgeItem label="STATUS">{statusBadge(emp.status)}</RowBadgeItem>
                    <RowDataItem label="JOIN DATE" className="text-[13px] text-[#4B4B52]">{emp.join_date ? format(new Date(emp.join_date), "MMM d, yyyy") : "—"}</RowDataItem>
                    <RowActions className="justify-self-end flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.id}`); }}
                        className="w-7 h-7 rounded-[8px] bg-[#F6F5F3] hover:bg-[#EBEBEB] text-[#4B4B52] flex items-center justify-center transition-colors"
                        title="View Profile"
                      >
                        <Eye className="h-3.5 w-3.5 text-[#4B4B52]" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeletingUser(emp); }}
                          className="w-7 h-7 rounded-[8px] bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#E5484D] flex items-center justify-center transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" />
                        </button>
                      )}
                    </RowActions>
                  </DataRow>
                );
              })}
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
                      const ok = await deleteUserRecord(deletingUser.id);
                      if (ok) {
                        toast.success("User and related data deleted");
                        queryClient.invalidateQueries({ queryKey: ["employees"] });
                        setDeletingUser(null);
                      } else {
                        toast.error("Failed to delete user");
                      }
                    } catch (err: any) {
                    toast.error(err?.message || String(err));
                  } finally { setDeleting(false); }
                }} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={bulkDeleteEmployeeOpen} onOpenChange={setBulkDeleteEmployeeOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {selectedEmployeeIds.size} User{selectedEmployeeIds.size > 1 ? "s" : ""}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-destructive font-medium">Warning: This will permanently delete the selected user accounts and all related data. This action cannot be undone.</p>
                <p className="text-sm">Are you sure you want to delete {selectedEmployeeIds.size} user{selectedEmployeeIds.size > 1 ? "s" : ""}?</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDeleteEmployeeOpen(false)}>Cancel</Button>
                <Button className="bg-destructive text-destructive-foreground" onClick={handleBulkDeleteEmployees} disabled={deleting}>{deleting ? "Deleting..." : "Delete all"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="shift" className="mt-6">
            <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] space-y-6 shadow-sm font-sans">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-[16px] text-[#17171A]">Global Shift & Leave Settings</h3>
                  <p className="text-[13px] text-[#8B8B92] mt-0.5">Used for employees who do not have a custom shift override.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveGlobalSettings}
                  disabled={savingSettings}
                  className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5 text-white" />
                  {savingSettings ? "Saving…" : "Save Settings"}
                </button>
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
            </div>
          </TabsContent>
        )}
      </Tabs>

      <CSVImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}
