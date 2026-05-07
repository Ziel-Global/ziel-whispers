import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Pencil, CheckCircle2, History, Send, ListPlus, AlertCircle, CalendarClock, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";

const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "marketing", "seo", "research", "posting", "designing", "other"];
const NO_PROJECT = "__none__";
const getStorageKey = (userId: string) => `ziel_pending_logs_${userId}`;

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
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { shiftStart, shiftEnd: resolvedShiftEnd } = useWorkSettings();
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [pendingLogs, setPendingLogs] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const today = getPKTDateString();

  // Load pending logs from local storage on mount/user change
  useEffect(() => {
    if (!user?.id) return;
    const key = getStorageKey(user.id);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setPendingLogs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved logs", e);
      }
    } else {
      setPendingLogs([]);
    }
  }, [user?.id]);

  // Save pending logs to local storage whenever they change
  useEffect(() => {
    if (!user?.id) return;
    const key = getStorageKey(user.id);
    localStorage.setItem(key, JSON.stringify(pendingLogs));
  }, [pendingLogs, user?.id]);

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
      const day = new Date(v + "T00:00:00").getDay();
      return day !== 0 && day !== 6;
    }, "Cannot submit logs for Saturday or Sunday").refine((v) => {
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

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { project_id: "", category: "", hours: 1, description: "", log_date: today },
  });

  const descValue = form.watch("description");
  const selectedDate = form.watch("log_date");

  // Fetch logs for the CURRENTLY SELECTED date in the form
  const { data: dateLogs = [] } = useQuery({
    queryKey: ["my-logs-date", user?.id, selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("log_date", selectedDate)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id && !!selectedDate,
  });

  const isSubmitted = dateLogs.length > 0 && profile?.role !== "admin";

  const onAddLog = (data: z.infer<typeof schema>) => {
    if (editId) {
      setPendingLogs(prev => prev.map(p => p.tempId === editId ? { ...data, tempId: editId } : p));
      setEditId(null);
      toast.success("Log updated");
    } else {
      setPendingLogs((prev) => [...prev, { ...data, tempId: crypto.randomUUID() }]);
      toast.success("Log added to list");
    }
    form.reset({ ...form.getValues(), hours: 1, description: "" });
  };

  const startEdit = (log: any) => {
    setEditId(log.tempId);
    form.reset({
      project_id: log.project_id,
      category: log.category,
      hours: log.hours,
      description: log.description,
      log_date: log.log_date
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    form.reset({ project_id: "", category: "", hours: 1, description: "", log_date: today });
  };

  const removePendingLog = (tempId: string) => {
    setPendingLogs((prev) => prev.filter((p) => p.tempId !== tempId));
    if (editId === tempId) cancelEdit();
  };

  const handleSubmitAll = async () => {
    if (pendingLogs.length === 0) return;
    setSubmitting(true);
    try {
      const nowPKT = new Date(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).format(new Date()));
      
      // Construct the deadline for TODAY
      const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
      const todayDeadline = new Date(`${todayStr}T${resolvedShiftEnd}`);
      
      // Handle overnight shifts for TODAY'S deadline
      if (shiftStart && resolvedShiftEnd && resolvedShiftEnd < shiftStart) {
        todayDeadline.setDate(todayDeadline.getDate() + 1);
      }
      
      // A log is late ONLY if submitted after the shift end of the SUBMISSION day
      const isLate = nowPKT > todayDeadline;

      const logsToInsert = pendingLogs.map((log) => {
        return {
          user_id: user!.id,
          project_id: log.project_id === NO_PROJECT ? null : log.project_id || null,
          category: log.category,
          hours: log.hours,
          description: log.description,
          log_date: log.log_date,
          is_late: isLate,
        };
      });

      const { error } = await supabase.from("daily_logs").insert(logsToInsert);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "log.bulk_submitted",
        target_entity: "daily_logs",
        metadata: { count: logsToInsert.length }
      });

      toast.success(`${logsToInsert.length} logs submitted successfully`);
      setPendingLogs([]);
      if (user?.id) localStorage.removeItem(getStorageKey(user.id));
      form.reset({ project_id: "", category: "", hours: 1, description: "", log_date: today });
      await queryClient.invalidateQueries({ queryKey: ["my-logs-date"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowSubmitConfirm(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalHoursForSelectedDate = [...dateLogs, ...pendingLogs.filter(p => p.log_date === selectedDate)].reduce((sum, l) => sum + Number(l.hours), 0);
  const progressPercentage = Math.min((totalHoursForSelectedDate / 8) * 100, 100);
  const remainingHoursForTarget = Math.max(8 - totalHoursForSelectedDate, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Logs</h1>
          <p className="text-muted-foreground mt-1">{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="text-xs font-mono">PKT Time</Badge>
        </div>
      </div>

      <Card className="p-6 border-2 border-primary/5 shadow-lg bg-card/50 backdrop-blur-sm">
        {/* Daily Progress Bar */}
        <div className="mb-8 p-4 bg-muted rounded-xl border border-primary/10">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-black" />
              <span className="text-md font-semibold">Logging Progress for {format(parseISO(selectedDate), "MMM d")}</span>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 bg-primary rounded-full">Target: 8 Hours</span>
          </div>
          <Progress value={progressPercentage} className="h-2 bg-gray-200" />
          <div className="flex justify-between items-center mt-2 text-xs">
            <p className="font-medium">{totalHoursForSelectedDate} of 8 hours logged</p>
            {remainingHoursForTarget > 0 ? (
              <p className="text-muted-foreground">{remainingHoursForTarget} {remainingHoursForTarget === 1 ? 'hour' : 'hours'} remaining</p>
            ) : (
              <p className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Goal Reached</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-primary rounded-lg text-primary">
            <ListPlus className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">{editId ? "Edit Log Entry" : "Add New Log Entry"}</h2>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onAddLog)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitted}>
                    <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitted}>
                    <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration (Hours)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.5" className="bg-background" {...field} onChange={e => field.onChange(Number(e.target.value))} disabled={isSubmitted} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="log_date" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Log Date</FormLabel>
                  <FormControl><Input type="date" className="bg-background" {...field} onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const day = new Date(v + "T00:00:00").getDay();
                      if (day === 0 || day === 6) {
                        toast.error("Cannot select Saturday or Sunday for logs");
                        return;
                      }
                    }
                    field.onChange(e);
                  }} min={minDate} max={today} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</FormLabel>
                <FormControl><Textarea {...field} rows={3} className="bg-background resize-none" placeholder="Explain your progress..." disabled={isSubmitted} /></FormControl>
                <div className="flex justify-between items-center px-1">
                  <FormMessage />
                  <span className={`text-[10px] font-mono ${descValue?.length < 20 ? "text-destructive" : "text-muted-foreground"}`}>{descValue?.length || 0} / 20 chars min</span>
                </div>
              </FormItem>
            )} />

            {isSubmitted ? (
              <div className="bg-muted p-6 rounded-xl border-2 border-dashed flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-primary/10 rounded-full"><Lock className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-bold">Logs Already Submitted</p>
                  <p className="text-sm text-muted-foreground">You have already submitted logs for {format(parseISO(selectedDate), "MMM do")}.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate("/logs/my")} className="rounded-button">Go to My Logs</Button>
              </div>
            ) : (
              <div className="flex justify-end gap-3 pt-2">
                {editId && (
                  <Button type="button" variant="ghost" onClick={cancelEdit} className="rounded-button">Cancel Edit</Button>
                )}
                <Button type="submit" className="rounded-button px-8">
                  {editId ? "Update Log Entry" : "Add Log Entry"}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </Card>

      {/* Pending Section */}
      {pendingLogs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-black" />
              <h2 className="text-lg font-semibold">Unsubmitted Logs</h2>
              <Badge variant="secondary" className="ml-1 bg-primary">{pendingLogs.length}</Badge>
            </div>
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting} className="rounded-button bg-primary hover:bg-primary/90 text-white px-6">
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit All Logs"}
            </Button>
          </div>
          <div className="grid gap-4">
            {pendingLogs.map((log) => (
              <Card key={log.tempId} className="p-4 bg-muted border-primary/10 transition-all hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary" className="bg-primary border-primary/20">
                        {projects.find(p => p.id === log.project_id)?.name || "Project"}
                      </Badge>
                      <Badge variant="secondary" className="capitalize text-[10px] bg-primary">{log.category.replace("_", " ")}</Badge>
                      <span className="text-sm font-bold text-black">{formatHours(log.hours)}</span>
                      <span className="text-sm text-muted-foreground font-mono">{format(parseISO(log.log_date), "MMM d, yyyy")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{log.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(log)} className="h-8 w-8 hover:text-primary"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removePendingLog(log.tempId)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* History Section for the SELECTED date */}
      {dateLogs.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-1">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">Submitted Logs for {format(parseISO(selectedDate), "MMM d")}</h2>
          </div>
          <div className="grid gap-3 opacity-75">
            {dateLogs.map((log: any) => (
              <Card key={log.id} className="p-4 bg-muted border-none shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      {log.projects?.name && <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">{log.projects.name}</Badge>}
                      <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">{log.category}</Badge>
                      <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                      {log.is_late && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge>}
                    </div>
                    <p className="text-sm text-black">{log.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[12px] text-muted-foreground font-mono">{formatPKTTime(log.submitted_at)}</span>
                    <Badge variant="secondary" className="text-[12px] bg-primary">Submitted</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Help Info */}
      <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border-black border border-2 border-dashed text-muted-foreground">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-xs">Tip: You can select a past date to submit logs you might have missed. Once a day is submitted, it is locked for changes.</p>
      </div>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><Send className="h-5 w-5" />Final Submission</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-semibold text-foreground">Are you sure you want to submit all {pendingLogs.length} logs?</p>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-800 text-xs flex gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p><strong>Warning:</strong> This action is irreversible and you can only submit logs once per day, so make sure all the logs of the day are added.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitAll} className="rounded-button bg-primary hover:bg-primary/90 text-white">Yes, Submit All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This unsubmitted log will be removed from your list.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && removePendingLog(deleteConfirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
