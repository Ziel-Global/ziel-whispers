import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { formatTime12h } from "@/hooks/useWorkSettings";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance","Management", "Other"];
const EMP_TYPES = ["full-time", "part-time", "contract"];
const ROLES = ["admin", "manager", "employee"];
const REMINDER_OPTIONS = [15, 30, 60];

const schema = z.object({
  full_name: z.string().min(3, "Name must be between 3 and 60 characters and contain only letters").max(60).regex(/^[a-zA-Z\s.'-]+$/, "Name must contain only letters"),
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
});

type FormData = z.infer<typeof schema>;

export default function EmployeeNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Pull defaults from admin settings — no hardcoded fallbacks
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

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", email: "", phone: "", designation: "", department: "",
      join_date: "", employment_type: "", role: "employee",
      shift_start: "", shift_end: "", reminder_offset_minutes: 0,
      password: "",
    },
  });

  // Once settings load, populate the shift/reminder defaults
  useEffect(() => {
    if (settings) {
      if (defaultShiftStart && !form.getValues("shift_start")) form.setValue("shift_start", defaultShiftStart);
      if (defaultShiftEnd && !form.getValues("shift_end")) form.setValue("shift_end", defaultShiftEnd);
      if (defaultReminder && !form.getValues("reminder_offset_minutes")) form.setValue("reminder_offset_minutes", defaultReminder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const resetForm = () => {
    form.reset({
      full_name: "", email: "", phone: "", designation: "", department: "",
      join_date: "", employment_type: "", role: "employee",
      shift_start: defaultShiftStart, shift_end: defaultShiftEnd,
      reminder_offset_minutes: defaultReminder,
      password: "",
    });
  };

  const onSubmit = async (data: FormData) => {
    if (!defaultShiftStart || !defaultShiftEnd || !defaultReminder) {
      toast.error("System settings missing. Ask an admin to configure default shift times and reminder offset in Settings.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("invite-user", { body: data });
      if (error) { toast.error(error.message || "Failed to create employee"); setSubmitting(false); return; }
      const res = result as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok) { toast.error(res.error || "Failed to create employee"); setSubmitting(false); return; }

      // Avatar upload is handled by users themselves; admins cannot upload avatars here.

      toast.success("Employee created successfully");
      resetForm();
    } catch (err: any) { toast.error(err.message || "Unexpected error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Employee</h1>
          <p className="text-muted-foreground mt-1">Create a new employee profile</p>
        </div>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar upload is disabled for admins when creating employees. Employees upload their own avatar. */}
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
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
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
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/employees")}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="rounded-button">{submitting ? "Creating…" : "Create Employee"}</Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
