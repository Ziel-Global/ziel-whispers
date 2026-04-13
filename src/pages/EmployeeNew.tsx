import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AvatarUpload } from "@/components/employees/AvatarUpload";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Other"];
const EMP_TYPES = ["Full-time", "Part-time", "Contract"];
const ROLES = ["admin", "manager", "employee"];
const REMINDER_OPTIONS = [15, 30, 60];

const schema = z.object({
  full_name: z.string().min(1, "Full name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().refine((v) => !v || /^\+?[\d\s\-()]{7,20}$/.test(v), "Invalid phone format"),
  designation: z.string().min(1, "Designation is required").max(100),
  department: z.string().min(1, "Department is required"),
  join_date: z.string().min(1, "Join date is required").refine((v) => new Date(v) <= new Date(), "Cannot be a future date"),
  employment_type: z.string().min(1, "Employment type is required"),
  role: z.string().min(1, "Role is required"),
  shift_start: z.string().default("09:00"),
  shift_end: z.string().default("18:00"),
  reminder_offset_minutes: z.number().default(30),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof schema>;

export default function EmployeeNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", email: "", phone: "", designation: "", department: "",
      join_date: "", employment_type: "", role: "employee",
      shift_start: "09:00", shift_end: "18:00", reminder_offset_minutes: 30,
      password: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("invite-user", {
        body: data,
      });

      if (error) {
        toast.error(error.message || "Failed to create employee");
        setSubmitting(false);
        return;
      }

      const res = result as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok) {
        toast.error(res.error || "Failed to create employee");
        setSubmitting(false);
        return;
      }

      // Upload avatar if provided
      if (avatarFile && res.user_id) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${res.user_id}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        await supabase.from("users").update({ avatar_url: path }).eq("id", res.user_id);
      }

      toast.success(`Employee created. Invite sent to ${data.email}.`);
      navigate("/employees");
    } catch (err: any) {
      toast.error(err.message || "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Employee</h1>
          <p className="text-muted-foreground mt-1">Create a new employee profile</p>
        </div>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <AvatarUpload onFileChange={setAvatarFile} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl><Input {...field} placeholder="John Doe" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl><Input {...field} type="email" placeholder="john@company.com" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input {...field} placeholder="+1 234 567 8900" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="designation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation *</FormLabel>
                  <FormControl><Input {...field} placeholder="Software Engineer" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="join_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Join Date *</FormLabel>
                  <FormControl><Input {...field} type="date" max={new Date().toISOString().split("T")[0]} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="employment_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employment Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EMP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
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
                  <FormControl><Input {...field} type="time" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shift_end" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift End</FormLabel>
                  <FormControl><Input {...field} type="time" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reminder_offset_minutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Offset</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {REMINDER_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type={showPw ? "text" : "password"} placeholder="Min 8 characters" />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/employees")}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="rounded-button">
                {submitting ? "Creating…" : "Create Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
