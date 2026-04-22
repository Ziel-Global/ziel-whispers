import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatTime12h } from "@/hooks/useWorkSettings";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Shield, ShieldOff, Download, Trash2 } from "lucide-react";
import { AvatarUpload } from "@/components/employees/AvatarUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Other"];
const EMP_TYPES = ["full-time", "part-time", "contract"];
const ROLES = ["admin", "manager", "employee"];
const REMINDER_OPTIONS = [15, 30, 60];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

const adminSchema = z.object({
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional().refine((v) => !v || /^03\d{9}$/.test(v), "Please enter a valid Pakistani phone number (03XXXXXXXXX)"),
  designation: z.string().min(1).max(100),
  department: z.string().min(1),
  join_date: z.string().min(1),
  employment_type: z.string().min(1),
  role: z.string().min(1),
  shift_start: z.string(),
  shift_end: z.string(),
  reminder_offset_minutes: z.number(),
  is_night_shift: z.boolean(),
});

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [emailWarningOpen, setEmailWarningOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminPwError, setAdminPwError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  // Work Logs filters
  const [logDateFilter, setLogDateFilter] = useState("");
  const [logProjectFilter, setLogProjectFilter] = useState("all");

  const isAdmin = myProfile?.role === "admin";
  const isOwnProfile = myProfile?.id === id;

  const { data: employee, isLoading, error: employeeError } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Work Logs for this employee
  const { data: workLogs = [] } = useQuery({
    queryKey: ["employee-work-logs", id, logDateFilter, logProjectFilter],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", id!)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (logDateFilter) query = query.eq("log_date", logDateFilter);
      if (logProjectFilter !== "all") query = query.eq("project_id", logProjectFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: !!id && isAdmin,
  });

  // Projects for filter
  const { data: employeeProjects = [] } = useQuery({
    queryKey: ["employee-projects-filter", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("projects(id, name)")
        .eq("user_id", id!)
        .is("removed_at", null);
      return (data || []).map((m: any) => m.projects).filter(Boolean);
    },
    enabled: !!id && isAdmin,
  });

  const totalLoggedHours = useMemo(() => workLogs.reduce((s: number, l: any) => s + Number(l.hours), 0), [workLogs]);

  // Global settings for shift comparison
  const { data: globalSettings } = useQuery({
    queryKey: ["system-settings-global"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value").in("key", ["default_shift_start", "default_shift_end"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  const form = useForm({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      full_name: employee?.full_name || "",
      email: employee?.email || "",
      phone: employee?.phone || "",
      designation: employee?.designation || "",
      department: employee?.department || "",
      join_date: employee?.join_date || "",
      employment_type: employee?.employment_type || "",
      role: employee?.role || "",
      shift_start: employee?.shift_start || "09:00",
      shift_end: employee?.shift_end || "17:00",
      reminder_offset_minutes: employee?.reminder_offset_minutes || 15,
      is_night_shift: employee?.is_night_shift ?? false,
    },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        full_name: employee.full_name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        designation: employee.designation || "",
        department: employee.department || "",
        join_date: employee.join_date || "",
        employment_type: employee.employment_type || "",
        role: employee.role || "",
        shift_start: employee.shift_start || "09:00",
        shift_end: employee.shift_end || "17:00",
        reminder_offset_minutes: employee.reminder_offset_minutes || 15,
        is_night_shift: employee.is_night_shift ?? false,
      });
    }
  }, [employee, form]);

  const avatarUrl = employee?.avatar_url ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${employee.avatar_url}` : undefined;

  const onSubmit = async (data: z.infer<typeof adminSchema>) => {
    if (!employee) return;
    if (data.email !== employee.email) {
      setPendingEmail(data.email);
      setEmailWarningOpen(true);
      return;
    }
    await saveProfile(data);
  };

  const saveProfile = async (data: z.infer<typeof adminSchema>) => {
    if (!employee) return;
    setSaving(true);
    try {
      const globalShiftStart = globalSettings?.default_shift_start;
      const globalShiftEnd = globalSettings?.default_shift_end;
      if (!globalShiftStart || !globalShiftEnd) {
        toast.error("Default shift times are not configured. Please set them in Settings first.");
        setSaving(false);
        return;
      }
      const hasCustomShift = data.shift_start !== globalShiftStart || data.shift_end !== globalShiftEnd;

      const { error } = await supabase.from("users").update({
        full_name: data.full_name,
        phone: data.phone || null,
        designation: data.designation,
        department: data.department,
        join_date: data.join_date,
        employment_type: data.employment_type,
        role: data.role,
        shift_start: data.shift_start,
        shift_end: data.shift_end,
        reminder_offset_minutes: data.reminder_offset_minutes,
        is_night_shift: data.is_night_shift,
        has_custom_shift: hasCustomShift,
      } as any).eq("id", employee.id);

      if (error) throw error;

      if (avatarFile && isOwnProfile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${employee.id}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        await supabase.from("users").update({ avatar_url: path }).eq("id", employee.id);
      }

      await supabase.from("audit_logs").insert({
        actor_id: myProfile?.id,
        action: "user.updated",
        target_entity: "users",
        target_id: employee.id,
      });

      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmEmailChange = async () => {
    setEmailWarningOpen(false);
    setSaving(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "update_email", user_id: employee!.id, new_email: pendingEmail },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to update email");

      const formData = form.getValues();
      formData.email = pendingEmail;
      await saveProfile(formData);
    } catch (err: any) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!employee) return;
    setDeactivating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "deactivate", user_id: employee.id },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to deactivate employee");
      toast.success("Employee deactivated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    if (!employee) return;
    setDeactivating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "reactivate", user_id: employee.id },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to reactivate employee");
      toast.success("Employee reactivated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    const { error } = await supabase.from("daily_logs").delete().eq("id", logId);
    if (error) { toast.error(error.message); return; }
    toast.success("Log entry deleted.");
    setDeleteLogId(null);
    queryClient.invalidateQueries({ queryKey: ["employee-work-logs"] });
  };

  const exportWorkLogs = () => {
    const header = "Date,Project,Category,Hours,Description,Submitted At\n";
    const rows = workLogs.map((l: any) =>
      `"${l.log_date}","${l.projects?.name || ""}","${l.category}",${l.hours},"${l.description?.replace(/"/g, '""')}","${format(new Date(l.submitted_at), "h:mm a")}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `work-logs-${employee?.full_name?.replace(/\s+/g, "-")}.csv`;
    a.click();
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (employeeError) return <div className="text-center py-12 text-muted-foreground">Failed to load employee. {(employeeError as any)?.message}</div>;
  if (!employee) return <div className="text-center py-12 text-muted-foreground">Employee not found</div>;

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-500",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={`${variants[status] || ""} capitalize`}>{status}</Badge>;
  };

  const canEdit = isAdmin;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{employee.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {statusBadge(employee.status)}
              <span className="text-muted-foreground text-sm">{employee.designation} · {employee.department}</span>
            </div>
          </div>
        </div>
        {isAdmin && !isOwnProfile && (
          <div className="flex gap-2">
            {employee.status === "active" || employee.status === "pending" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deactivating}>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Deactivate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate Employee?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately revoke their system access and force logout. All historical data is preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="outline" size="sm" onClick={handleReactivate} disabled={deactivating}>
                <Shield className="h-4 w-4 mr-2" />
                Reactivate
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="logs">Work Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {isOwnProfile ? (
                  <AvatarUpload currentUrl={avatarUrl} onFileChange={setAvatarFile} />
                ) : (
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-muted text-muted-foreground">{employee.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="full_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="designation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="join_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Join Date</FormLabel>
                      <FormControl><Input {...field} type="date" disabled={!canEdit} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="employment_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="shift_start" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift Start (Override)</FormLabel>
                      <FormControl><Input {...field} type="time" disabled={!canEdit} /></FormControl>
                      <p className="text-xs text-muted-foreground">Currently: {formatTime12h(field.value)}. Leave as default to use global shift setting.</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="shift_end" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift End (Override)</FormLabel>
                      <FormControl><Input {...field} type="time" disabled={!canEdit} /></FormControl>
                      <p className="text-xs text-muted-foreground">Currently: {formatTime12h(field.value)}. Leave as default to use global shift setting.</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="reminder_offset_minutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reminder Offset</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)} disabled={!canEdit}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {REMINDER_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {canEdit && (
                  <FormField control={form.control} name="is_night_shift" render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
                      </FormControl>
                      <div>
                        <FormLabel className="text-sm font-medium">Night Shift Employee</FormLabel>
                        <p className="text-xs text-muted-foreground">Skip automatic midnight clock-out for this employee</p>
                      </div>
                    </FormItem>
                  )} />
                )}

                {!canEdit && !isOwnProfile && (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">Contact your admin to change profile details.</p>
                )}

                {canEdit && (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="rounded-button">
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </Card>

          {isAdmin && !isOwnProfile && (
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold">Change Password</h3>
                <p className="text-sm text-muted-foreground mt-1">Set a new password for this employee. They will use it on their next login.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password <span className="text-destructive">*</span></Label>
                  <PasswordInput value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} showStrength />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password <span className="text-destructive">*</span></Label>
                  <PasswordInput value={adminConfirmPassword} onChange={(e) => setAdminConfirmPassword(e.target.value)} />
                </div>
              </div>
              {adminPwError && <p className="text-sm text-destructive">{adminPwError}</p>}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  disabled={settingPassword}
                  onClick={async () => {
                    setAdminPwError("");
                    if (adminNewPassword.length < 8) { setAdminPwError("Password must be at least 8 characters"); return; }
                    if (!/[0-9]/.test(adminNewPassword)) { setAdminPwError("Password must contain a number"); return; }
                    if (!/[^a-zA-Z0-9]/.test(adminNewPassword)) { setAdminPwError("Password must contain a special character"); return; }
                    if (adminNewPassword !== adminConfirmPassword) { setAdminPwError("Passwords do not match"); return; }
                    setSettingPassword(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("manage-user", {
                        body: { action: "set_password", user_id: id, new_password: adminNewPassword },
                      });
                      if (error) {
                        toast.error(error.message || "Failed to set password");
                      } else if (!(data as any)?.ok) {
                        toast.error((data as any)?.error || "Failed to set password");
                      } else {
                        toast.success("Password updated successfully");
                        setAdminNewPassword("");
                        setAdminConfirmPassword("");
                      }
                    } catch (err: any) {
                      toast.error(err.message);
                    } finally {
                      setSettingPassword(false);
                    }
                  }}
                >
                  {settingPassword ? "Updating…" : "Update Password"}
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="logs" className="space-y-4">
            {/* Summary */}
            <Card className="p-4">
              <p className="text-sm font-medium">Total Logged Hours (filtered): <strong>{formatHours(totalLoggedHours)}</strong></p>
            </Card>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                type="date"
                value={logDateFilter}
                onChange={(e) => setLogDateFilter(e.target.value)}
                className="w-[170px]"
                placeholder="Filter by date"
              />
              {logDateFilter && (
                <Button variant="ghost" size="sm" onClick={() => setLogDateFilter("")}>Clear date</Button>
              )}
              <Select value={logProjectFilter} onValueChange={setLogProjectFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {employeeProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportWorkLogs}>
                <Download className="h-4 w-4 mr-1" />CSV
              </Button>
            </div>

            {/* Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No logs found</TableCell></TableRow>
                  ) : (
                    workLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                        <TableCell>{log.projects?.name || "—"}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{log.description}</TableCell>
                        <TableCell className="font-medium">{formatHours(log.hours)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(log.submitted_at), "h:mm a")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteLogId(log.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteLogId} onOpenChange={(open) => !open && setDeleteLogId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete this log?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is permanent and cannot be undone. This log entry will be removed from the employee's record.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteLogId && handleDeleteLog(deleteLogId)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={emailWarningOpen} onOpenChange={setEmailWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Changing the email from <strong>{employee.email}</strong> to <strong>{pendingEmail}</strong> will update their login credentials. This action cannot be undone easily.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailWarningOpen(false)}>Cancel</Button>
            <Button onClick={confirmEmailChange} disabled={saving}>Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
