import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkSettings, getPKTDateString, formatPKTTime } from "@/hooks/useWorkSettings";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "other"];
const NO_PROJECT = "__none__";

function getMinDateStr(days: number) {
  const d = new Date(getPKTDateString());
  d.setDate(d.getDate() - days);
  return format(d, "yyyy-MM-dd");
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function LogSubmitPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { shiftEnd: resolvedShiftEnd } = useWorkSettings();
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const today = getPKTDateString();

  // Fetch configurable log edit window (in days)
  const { data: logEditDays = 3 } = useQuery({
    queryKey: ["system-setting-log-edit-days"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "log_edit_window_days").maybeSingle();
      return data ? Number(data.value) : 3;
    },
  });

  const minDate = getMinDateStr(logEditDays);

  const schema = z.object({
    project_id: z.string().min(1, "Please select a project").refine(v => v !== NO_PROJECT, "Please select a project"),
    category: z.string().min(1, "Category is required"),
    hours: z.number().min(0.5, "Min 0.5 hours").max(24, "Max 24 hours"),
    description: z.string().min(20, "Min 20 characters"),
    log_date: z.string().min(1, "Date is required").refine((v) => {
      return v >= minDate && v <= today;
    }, `You can only submit logs for today or up to ${logEditDays} days in the past`),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id, projects(id, name, status)")
        .eq("user_id", user!.id)
        .is("removed_at", null);
      return (memberships || [])
        .map((m: any) => m.projects)
        .filter((p: any) => p && p.status === "active")
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id,
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["my-logs-today", user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("log_date", today)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { project_id: "", category: "", hours: 1, description: "", log_date: today },
  });

  const descValue = form.watch("description");

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setSubmitting(true);
    try {
      const nowPKT = new Date(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).format(new Date()));
      const [h, m] = resolvedShiftEnd.split(":").map(Number);
      const shiftEndTime = new Date(nowPKT);
      shiftEndTime.setHours(h, m, 0);
      const isLate = data.log_date === today && nowPKT > shiftEndTime;
      const isPastDate = data.log_date < today;

      const projectId = data.project_id === NO_PROJECT ? null : data.project_id || null;

      const { error } = await supabase.from("daily_logs").insert({
        user_id: user!.id,
        project_id: projectId,
        category: data.category,
        hours: data.hours,
        description: data.description,
        log_date: data.log_date,
        is_late: isLate || isPastDate,
      });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user!.id, action: "log.submitted", target_entity: "daily_logs",
      });

      toast.success("Log submitted successfully");
      form.reset({ project_id: "", category: "", hours: 1, description: "", log_date: today });
      await queryClient.invalidateQueries({ queryKey: ["my-logs-today"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const deleteLog = async (id: string) => {
    const { error } = await supabase.from("daily_logs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Log entry deleted.");
    setDeleteConfirmId(null);
    await queryClient.invalidateQueries({ queryKey: ["my-logs-today"] });
    await queryClient.invalidateQueries({ queryKey: ["my-logs"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Submit Daily Log</h1>
        <p className="text-muted-foreground mt-1">{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p>
      </div>

      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
        You can submit logs for the past {logEditDays} days only.
      </p>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project <span className="text-destructive">*</span></FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.5" 
                      min="0.5" 
                      max="24" 
                      {...field} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > 24) {
                          e.target.value = "24";
                          field.onChange(24);
                        } else {
                          field.onChange(Number(e.target.value));
                        }
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="log_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" {...field} min={minDate} max={today} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description <span className="text-destructive">*</span></FormLabel>
                <FormControl><Textarea {...field} rows={3} placeholder="What did you work on? (min 20 chars)" /></FormControl>
                <div className="flex justify-between">
                  <FormMessage />
                  <span className="text-xs text-muted-foreground">{descValue?.length || 0} chars</span>
                </div>
              </FormItem>
            )} />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting} className="rounded-button">
                {submitting ? "Submitting…" : "Submit Log"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>

      {todayLogs.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Today's Logs</h3>
          <div className="space-y-3">
            {todayLogs.map((log: any) => (
              <div key={log.id} className="flex items-start justify-between p-3 bg-muted rounded-md">
                <div className="space-y-1">
                  <div className="flex gap-2">
                    {log.projects?.name && <Badge variant="outline">{log.projects.name}</Badge>}
                    <Badge variant="secondary">{log.category}</Badge>
                    <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                    {log.is_late && <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{log.description}</p>
                </div>
                {!log.is_locked && (
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(log.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this log?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. This log entry will be removed from your record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteLog(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
