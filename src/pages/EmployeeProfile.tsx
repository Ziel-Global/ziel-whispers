import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, ShieldOff, Eye } from "lucide-react";
import { AvatarUpload } from "@/components/employees/AvatarUpload";
import { LeaveBalancesTab } from "@/components/employees/LeaveBalancesTab";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Other"];
const EMP_TYPES = ["Full-time", "Part-time", "Contract"];
const ROLES = ["admin", "manager", "employee"];
const REMINDER_OPTIONS = [15, 30, 60];
const SUPABASE_URL = "https://goutpygixoxkgbrfmkey.supabase.co";

const adminSchema = z.object({
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional().refine((v) => !v || /^\+?[\d\s\-()]{7,20}$/.test(v), "Invalid phone"),
  designation: z.string().min(1).max(100),
  department: z.string().min(1),
  join_date: z.string().min(1),
  employment_type: z.string().min(1),
  role: z.string().min(1),
  shift_start: z.string(),
  shift_end: z.string(),
  reminder_offset_minutes: z.number(),
});

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const { startImpersonation } = useImpersonation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [emailWarningOpen, setEmailWarningOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const isAdmin = myProfile?.role === "admin";
  const isManager = myProfile?.role === "manager";
  const isOwnProfile = myProfile?.id === id;

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const form = useForm({
    resolver: zodResolver(adminSchema),
    values: employee ? {
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || "",
      designation: employee.designation,
      department: employee.department,
      join_date: employee.join_date,
      employment_type: employee.employment_type,
      role: employee.role,
      shift_start: employee.shift_start,
      shift_end: employee.shift_end,
      reminder_offset_minutes: employee.reminder_offset_minutes,
    } : undefined,
  });

  const avatarUrl = employee?.avatar_url ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${employee.avatar_url}` : undefined;

  const onSubmit = async (data: z.infer<typeof adminSchema>) => {
    if (!employee) return;
    // Check if email changed
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
      }).eq("id", employee.id);

      if (error) throw error;

      if (avatarFile) {
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
      const res = result as { error?: string };
      if (res.error) throw new Error(res.error);

      // Save other fields too
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
      const res = result as { error?: string };
      if (res.error) throw new Error(res.error);
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
      const res = result as { error?: string };
      if (res.error) throw new Error(res.error);
      toast.success("Employee reactivated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
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
    <div className="max-w-2xl mx-auto space-y-6">
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
        {isAdmin && (
          <div className="flex gap-2">
            {!isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  startImpersonation({
                    id: employee.id,
                    name: employee.full_name,
                    role: employee.role,
                    department: employee.department,
                  });
                  await supabase.from("audit_logs").insert({
                    actor_id: myProfile?.id,
                    action: "impersonation.started",
                    target_entity: "users",
                    target_id: employee.id,
                  });
                  navigate("/");
                }}
              >
                <Eye className="h-4 w-4 mr-2" />View As
              </Button>
            )}
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
                      This will immediately revoke their system access. All historical data is preserved. Are you sure?
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

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <AvatarUpload currentUrl={avatarUrl} onFileChange={setAvatarFile} />

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
                  <FormControl><Input {...field} disabled={!canEdit && !isOwnProfile} /></FormControl>
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
                      {EMP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                  <FormLabel>Shift Start</FormLabel>
                  <FormControl><Input {...field} type="time" disabled={!canEdit && !isOwnProfile} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shift_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift End</FormLabel>
                  <FormControl><Input {...field} type="time" disabled={!canEdit && !isOwnProfile} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reminder_offset_minutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Offset</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)} disabled={!canEdit && !isOwnProfile}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {REMINDER_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {!canEdit && !isOwnProfile && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">Contact your admin to change profile details.</p>
            )}

            {(canEdit || isOwnProfile) && (
              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="rounded-button">
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </Card>

      {/* D3 — Leave Balances (Admin only) */}
      {isAdmin && <LeaveBalancesTab employeeId={employee.id} />}

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
