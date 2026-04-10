import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = ["Development", "Meeting", "Bug Fix", "Code Review", "Deployment", "Documentation", "Testing", "Other"];

const schema = z.object({
  project_id: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  hours: z.number().min(0.5, "Min 0.5 hours").max(24, "Max 24 hours"),
  description: z.string().min(20, "Min 20 characters"),
  log_date: z.string().min(1, "Date is required"),
});

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function LogSubmitPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];

  // Employee's assigned projects
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
        .filter((p: any) => p && p.status === "active");
    },
    enabled: !!user?.id,
  });

  // Today's logs
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
      // Check if late (after shift end)
      const shiftEnd = (profile as any)?.shift_end || "18:00";
      const now = new Date();
      const [h, m] = shiftEnd.split(":").map(Number);
      const shiftEndTime = new Date();
      shiftEndTime.setHours(h, m + 30, 0); // 30 min grace
      const isLate = data.log_date === today && now > shiftEndTime;
      const isPastDate = data.log_date < today;

      const { error } = await supabase.from("daily_logs").insert({
        user_id: user!.id,
        project_id: data.project_id || null,
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
      queryClient.invalidateQueries({ queryKey: ["my-logs-today"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const deleteLog = async (id: string) => {
    const { error } = await supabase.from("daily_logs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Log deleted");
    queryClient.invalidateQueries({ queryKey: ["my-logs-today"] });
  };

  const submitted = todayLogs.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submit Daily Log</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Badge className={submitted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}>
          {submitted ? "Submitted" : "Not submitted yet"}
        </Badge>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">No project</SelectItem>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.5" min="0.5" max="24" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="log_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} min={threeDaysAgo} max={today} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
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
                  <Button variant="ghost" size="icon" onClick={() => deleteLog(log.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
