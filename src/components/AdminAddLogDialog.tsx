import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { getPKTDateString } from "@/hooks/useWorkSettings";

const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "marketing", "seo", "research", "posting", "designing", "other"];
const NO_PROJECT = "__none__";

const schema = z.object({
  user_id: z.string().min(1, "Please select an employee"),
  project_id: z.string().min(1, "Please select a project").refine(v => v !== NO_PROJECT, "Please select a project"),
  category: z.string().min(1, "Category is required"),
  hours: z.number().min(0.25, "Min 0.25 hours").max(24, "Max 24 hours"),
  description: z.string().optional(),
  log_date: z.string().min(1, "Date is required"),
});

export function AdminAddLogDialog({ employees }: { employees: any[] }) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      user_id: "",
      project_id: "",
      category: "",
      hours: 1,
      description: "",
      log_date: getPKTDateString(),
    },
  });

  const selectedUserId = form.watch("user_id");

  // Reset project_id when user_id changes
  useEffect(() => {
    form.setValue("project_id", "");
  }, [selectedUserId, form]);

  const { data: userProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["user-projects", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data } = await supabase
        .from("project_members")
        .select("project_id, projects(id, name, status)")
        .eq("user_id", selectedUserId)
        .is("removed_at", null);
      return (data || [])
        .map((m: any) => m.projects)
        .filter((p: any) => p && p.status === "active")
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!selectedUserId,
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setSubmitting(true);
    try {
      // Validate that the project is assigned to the employee
      const isAssigned = userProjects.some((p: any) => p.id === data.project_id);
      if (!isAssigned && data.project_id !== NO_PROJECT) {
        toast.error("This project is not assigned to the selected employee");
        setSubmitting(false);
        return;
      }

      // Find if employee is overtime enabled
      const emp = employees.find(e => e.id === data.user_id);
      const isOvertimeEnabled = emp?.overtime_enabled === true;

      // Calculate if it's overtime (simplistic logic: if enabled, we might need to check total hours. The requirement says:
      // "This log should be saved exactly the same way as a normal employee log".
      // Since it's complex, we'll let the existing views sort it out or mark it not overtime by default,
      // but to be safe, if we just insert it, the LogsAdmin groups it correctly.)
      // Note: `is_overtime` is usually determined at submit time for overtime users. Let's just set it to false and let the admin manage it,
      // or we can just calculate it based on currently logged hours for that user on that day.
      let isOvertime = false;
      if (isOvertimeEnabled) {
        const { data: existingLogs } = await supabase
          .from("daily_logs")
          .select("hours")
          .eq("user_id", data.user_id)
          .eq("log_date", data.log_date);
        const existingTotal = (existingLogs || []).reduce((sum, l) => sum + Number(l.hours), 0);
        if (existingTotal + data.hours > 8) {
          isOvertime = true;
        }
      }

      const { error } = await supabase.from("daily_logs").insert({
        user_id: data.user_id,
        project_id: data.project_id === NO_PROJECT ? null : data.project_id || null,
        category: data.category,
        hours: data.hours,
        description: data.description || "",
        log_date: data.log_date,
        is_late: false,
        is_overtime: isOvertime,
      });

      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: currentUser?.id,
        action: "log.admin_added",
        target_entity: "daily_logs",
        target_id: data.user_id,
        metadata: { log_date: data.log_date, hours: data.hours, added_for_user: data.user_id }
      });

      toast.success("Log added successfully");
      setOpen(false);
      form.reset({
        user_id: "",
        project_id: "",
        category: "",
        hours: 1,
        description: "",
        log_date: getPKTDateString(),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) form.reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Add Log</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Log</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="user_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Employee</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="log_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} max={getPKTDateString()} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedUserId}>
                    <FormControl><SelectTrigger><SelectValue placeholder={!selectedUserId ? "Select employee first" : (loadingProjects ? "Loading..." : "Project")} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {userProjects.length > 0 ? (
                        <>
                          <SelectItem value={NO_PROJECT}>No Project</SelectItem>
                          {userProjects.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </>
                      ) : (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          {selectedUserId ? "No projects assigned to this employee" : "Please select an employee"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="hours" render={({ field }) => (
              <FormItem>
                <FormLabel>Hours</FormLabel>
                <FormControl>
                  <Input type="number" step="0.25" min="0.25" max="24" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea rows={3} className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="mr-2">Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Log"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
