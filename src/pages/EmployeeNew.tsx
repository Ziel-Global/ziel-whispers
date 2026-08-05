import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { formatTime12h } from "@/hooks/useWorkSettings";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];
const EMP_TYPES = ["full-time", "part-time", "contract"];
const REMINDER_OPTIONS = [15, 30, 60];

// ─── Schema for Admin / Manager / Employee ───────────────────────────────────
const staffSchema = z.object({
  full_name: z.string().min(3, "Name must be between 3 and 60 characters").max(60).regex(/^[a-zA-Z\s.'-]+$/, "Name must contain only letters"),
  email: z.string().email("Please enter a valid email address").refine((v) => !/\s/.test(v), "No spaces allowed"),
  phone: z.string().optional().refine((v) => !v || /^03\d{9}$/.test(v), "Please enter a valid Pakistani phone number (03XXXXXXXXX)"),
  designation: z.string().min(1, "Designation is required").max(100),
  department: z.string().min(1, "Department is required"),
  join_date: z.string().min(1, "Join date is required").refine((v) => new Date(v) <= new Date(), "Cannot be a future date"),
  employment_type: z.string().min(1, "Employment type is required"),
  role: z.string().min(1, "Role is required"),
  shift_start: z.string().min(1, "Shift start required"),
  shift_end: z.string().min(1, "Shift end required"),
  reminder_offset_minutes: z.number().min(1),
  password: z.string().min(8, "Min 8 characters").regex(/[0-9]/, "Must contain a number").regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
  working_days: z.number().min(5).max(6),
});

// ─── Schema for Client ────────────────────────────────────────────────────────
const clientSchema = z.object({
  full_name: z.string().min(3, "Name must be between 3 and 60 characters").max(60).regex(/^[a-zA-Z\s.'-]+$/, "Name must contain only letters"),
  email: z.string().email("Please enter a valid email address").refine((v) => !/\s/.test(v), "No spaces allowed"),
  password: z.string().min(8, "Min 8 characters").regex(/[0-9]/, "Must contain a number").regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
  project_id: z.string().optional(),
  client_id: z.string().optional(),
});

type StaffFormData = z.infer<typeof staffSchema>;
type ClientFormData = z.infer<typeof clientSchema>;

type RoleType = "admin" | "manager" | "employee" | "client" | "client member" | "client portal";

// ─── Step 1: Role Picker (Dropdown style) ─────────────────────────────────────
function RolePicker({ onSelect }: { onSelect: (role: RoleType) => void }) {
  const [role, setRole] = useState<RoleType | "">("");

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add New User</h1>
        <p className="text-muted-foreground mt-1">Select the type of user you want to create</p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Role <span className="text-destructive">*</span>
          </label>
          <Select value={role} onValueChange={(v) => setRole(v as RoleType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role…" />
            </SelectTrigger>
            <SelectContent> 
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="client member">Client Member</SelectItem>
              {/* <SelectItem value="client portal">Client Portal</SelectItem> */}
            </SelectContent>
          </Select>
          {role && (
            <p className="text-xs text-muted-foreground pt-0.5">
              {role === "admin" && "Full system access — manage users, settings & all data"}
              {role === "manager" && "Manage team attendance, logs, leave, and projects"}
              {role === "employee" && "Standard employee — submit logs, apply for leave"}
              {role === "client" && "Client who owns the project — portal access to assigned projects"}
              {role === "client member" && "Member of the client's team — portal access to assigned projects"}
              {role === "client portal" && "Client portal user — portal access to assigned projects via /portal"}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            className="rounded-button"
            disabled={!role}
            onClick={() => role && onSelect(role)}
          >
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Step 2A: Staff Form (Admin / Manager / Employee) ─────────────────────────
function StaffForm({ selectedRole, onBack }: { selectedRole: RoleType; onBack: () => void }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["system-settings-defaults-new-emp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["default_shift_start", "default_shift_end", "reminder_offset_minutes"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  const defaultShiftStart = settings?.default_shift_start ?? "";
  const defaultShiftEnd = settings?.default_shift_end ?? "";
  const defaultReminder = Number(settings?.reminder_offset_minutes ?? 0);

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      full_name: "", email: "", phone: "", designation: "", department: "",
      join_date: "", employment_type: "", role: selectedRole,
      shift_start: "", shift_end: "", reminder_offset_minutes: 0,
      password: "", working_days: 5,
    },
  });

  useEffect(() => {
    if (settings) {
      if (defaultShiftStart && !form.getValues("shift_start")) form.setValue("shift_start", defaultShiftStart);
      if (defaultShiftEnd && !form.getValues("shift_end")) form.setValue("shift_end", defaultShiftEnd);
      if (defaultReminder && !form.getValues("reminder_offset_minutes")) form.setValue("reminder_offset_minutes", defaultReminder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const onSubmit = async (data: StaffFormData) => {
    if (!defaultShiftStart || !defaultShiftEnd || !defaultReminder) {
      toast.error("System settings missing. Ask an admin to configure default shift times and reminder offset in Settings.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("invite-user", { body: { ...data, app_url: window.location.origin } });
      if (error) { toast.error(error.message || "Failed to create user"); setSubmitting(false); return; }
      const res = result as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok) { toast.error(res.error || "Failed to create user"); setSubmitting(false); return; }
      toast.success(`${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} created successfully`);
      navigate("/employees");
    } catch (err: any) { toast.error(err.message || "Unexpected error"); }
    finally { setSubmitting(false); }
  };

  const roleLabel = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New {roleLabel}</h1>
          <p className="text-muted-foreground mt-1">Fill in the details for the new {roleLabel.toLowerCase()} account</p>
        </div>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>Full Name <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="John Doe" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} type="email" placeholder="john@company.com" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} placeholder="03001234567" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="designation" render={({ field }) => (
                <FormItem><FormLabel>Designation <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} placeholder="Software Engineer" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Department <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                    <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="join_date" render={({ field }) => (
                <FormItem><FormLabel>Join Date <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} type="date" max={new Date().toISOString().split("T")[0]} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="employment_type" render={({ field }) => (
                <FormItem><FormLabel>Employment Type <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type"><span className="capitalize">{field.value}</span></SelectValue></SelectTrigger></FormControl>
                    <SelectContent>{EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              {/* Role is pre-set but shown as read-only */}
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-muted cursor-not-allowed capitalize" value={field.value} />
                  </FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shift_start" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Start</FormLabel>
                  <FormControl><Input {...field} type="time" /></FormControl>
                  {field.value && <p className="text-xs text-muted-foreground">Displayed as {formatTime12h(field.value)}</p>}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shift_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift End</FormLabel>
                  <FormControl><Input {...field} type="time" /></FormControl>
                  {field.value && <p className="text-xs text-muted-foreground">Displayed as {formatTime12h(field.value)}</p>}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reminder_offset_minutes" render={({ field }) => (
                <FormItem><FormLabel>Reminder Offset</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{REMINDER_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <PasswordInput {...field} placeholder="Min 8 characters" showStrength />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="working_days" render={({ field }) => (
                <FormItem><FormLabel>Working Days <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                      <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onBack}>Back</Button>
              <Button type="submit" disabled={submitting} className="rounded-button">
                {submitting ? "Creating…" : `Create ${roleLabel}`}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}

// ─── Step 2B: Client Form ──────────────────────────────────────────────────────
function ClientForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-for-client"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["active", "on_hold"])
        .order("name");
      return data || [];
    },
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { full_name: "", email: "", password: "", project_id: "" },
  });

  const onSubmit = async (data: ClientFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        designation: "Client",
        role: "client",
        department: "Other",
        employment_type: "contract",
        join_date: new Date().toISOString().split("T")[0],
      };

      const { data: result, error } = await supabase.functions.invoke("invite-user", { body: { ...payload, app_url: window.location.origin } });
      if (error) { toast.error(error.message || "Failed to create client"); setSubmitting(false); return; }
      const res = result as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok) { toast.error(res.error || "Failed to create client"); setSubmitting(false); return; }

      // If a project was selected, add the client as a project member
      if (data.project_id && res.user_id) {
        // Get or create a "Client" role for this project
        let roleId: string | null = null;
        const { data: existingRole } = await supabase
          .from("project_roles")
          .select("id")
          .eq("project_id", data.project_id)
          .eq("name", "Client")
          .maybeSingle();

        if (existingRole) {
          roleId = existingRole.id;
        } else {
          const { data: newRole } = await supabase
            .from("project_roles")
            .insert({ project_id: data.project_id, name: "Client" })
            .select("id")
            .single();
          roleId = newRole?.id || null;
        }

        await supabase.from("project_members").insert({
          project_id: data.project_id,
          user_id: res.user_id,
          project_role_id: roleId,
        });

        await supabase.from("audit_logs").insert({
          actor_id: profile?.id,
          action: "project.member_added",
          target_entity: "project_members",
          target_id: data.project_id,
          metadata: { user_id: res.user_id, via: "client_creation" },
        });
      }

      toast.success("Client created successfully. A welcome email with password setup link has been sent.");
      navigate("/employees");
    } catch (err: any) { toast.error(err.message || "Unexpected error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Client</h1>
          <p className="text-muted-foreground mt-1">Create a client portal account</p>
        </div>
      </div>

      <Card className="p-6">
        {/* Info banner */}
        <div className="mb-6 p-4 rounded-lg bg-muted border border-border text-sm text-foreground">
          <p className="font-semibold mb-1">📧 Welcome Email</p>
          <p className="text-muted-foreground">The client will automatically receive a branded welcome email with a link to set their password and access the portal.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Ahmed Khan" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} type="email" placeholder="client@company.com" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <PasswordInput {...field} placeholder="Min 8 characters" showStrength />
                </FormControl>
                <p className="text-xs text-muted-foreground">The client will be prompted to change this via the welcome email link.</p>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Assign to Project <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {projects.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No active projects found</div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The client will be added as a member to this project immediately.</p>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onBack}>Back</Button>
              <Button type="submit" disabled={submitting} className="rounded-button">
                {submitting ? "Creating…" : "Create Client"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}

// ─── Step 2C: Client Member Form ────────────────────────────────────────────────
function ClientMemberForm({ onBack, portalMode }: { onBack: () => void; portalMode?: boolean }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-for-client-member"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["active", "on_hold"])
        .order("name");
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list-for-client-member"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { full_name: "", email: "", password: "", project_id: "" },
  });

  const onSubmit = async (data: ClientFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        designation: portalMode ? "Client Portal" : "Client Member",
        role: portalMode ? "client portal" : "client member",
        department: "Other",
        employment_type: "contract",
        join_date: new Date().toISOString().split("T")[0],
        ...(data.client_id ? { client_id: data.client_id } : {}),
      };

      const { data: result, error } = await supabase.functions.invoke("invite-user", { body: { ...payload, app_url: window.location.origin } });
      if (error) { toast.error(error.message || (portalMode ? "Failed to create client portal user" : "Failed to create client member")); setSubmitting(false); return; }
      const res = result as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok) { toast.error(res.error || (portalMode ? "Failed to create client portal user" : "Failed to create client member")); setSubmitting(false); return; }

      // If a project was selected, add the client member as a project member
      if (data.project_id && res.user_id) {
        let roleId: string | null = null;
        const { data: existingRole } = await supabase
          .from("project_roles")
          .select("id")
          .eq("project_id", data.project_id)
          .eq("name", "Client")
          .maybeSingle();

        if (existingRole) {
          roleId = existingRole.id;
        } else {
          const { data: newRole } = await supabase
            .from("project_roles")
            .insert({ project_id: data.project_id, name: "Client" })
            .select("id")
            .single();
          roleId = newRole?.id || null;
        }

        await supabase.from("project_members").insert({
          project_id: data.project_id,
          user_id: res.user_id,
          project_role_id: roleId,
        });

        await supabase.from("audit_logs").insert({
          actor_id: profile?.id,
          action: "project.member_added",
          target_entity: "project_members",
          target_id: data.project_id,
          metadata: { user_id: res.user_id, via: "client_member_creation" },
        });
      }

      toast.success(portalMode ? "Client Portal user created successfully. A welcome email with password setup link has been sent." : "Client Member created successfully. A welcome email with password setup link has been sent.");
      navigate("/employees");
    } catch (err: any) { toast.error(err.message || "Unexpected error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{portalMode ? "Add New Client Portal User" : "Add New Client Member"}</h1>
          <p className="text-muted-foreground mt-1">{portalMode ? "Create an account for a client portal user" : "Create an account for a member of the client's team"}</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-6 p-4 rounded-lg bg-muted border border-border text-sm text-foreground">
          <p className="font-semibold mb-1">📧 Welcome Email</p>
          <p className="text-muted-foreground">The client member will automatically receive a branded welcome email with a link to set their password and access the portal.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Sara Ahmed" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} type="email" placeholder="member@client-company.com" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <PasswordInput {...field} placeholder="Min 8 characters" showStrength />
                </FormControl>
                <p className="text-xs text-muted-foreground">The client member will be prompted to change this via the welcome email link.</p>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="client_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Link to Client {portalMode && <span className="text-destructive">*</span>} {!portalMode && <span className="text-muted-foreground text-xs">(optional)</span>}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    {clients.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No clients found</div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{portalMode ? "Required — this links the portal user to a client and auto-assigns their projects." : "Linking to a client auto-syncs project access."}</p>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Assign to Project <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {projects.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No active projects found</div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The client member will be added as a member to this project immediately.</p>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onBack}>Back</Button>
              <Button type="submit" disabled={submitting} className="rounded-button">
                {submitting ? "Creating…" : "Create Client Member"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}

// ─── Main Page: Orchestrates the 2-step flow ───────────────────────────────────
export default function EmployeeNewPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);

  const handleBack = () => setSelectedRole(null);

  // Step 1: No role selected — show the role picker
  if (!selectedRole) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/employees"); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <RolePicker onSelect={setSelectedRole} />
      </div>
    );
  }

  // Step 2B: Client selected
  if (selectedRole === "client") {
    return <ClientForm onBack={handleBack} />;
  }

  // Step 2C: Client Member selected
  if (selectedRole === "client member") {
    return <ClientMemberForm onBack={handleBack} />;
  }

  // Step 2D: Client Portal selected
  if (selectedRole === "client portal") {
    return <ClientMemberForm onBack={handleBack} portalMode />;
  }

  // Step 2A: Admin / Manager / Employee
  return <StaffForm selectedRole={selectedRole} onBack={handleBack} />;
}
