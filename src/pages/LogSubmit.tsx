import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkSettings, getPKTDateString, formatPKTTime, getPKTISOString } from "@/hooks/useWorkSettings";
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
import { Trash2, Pencil, CheckCircle2, History, Send, ListPlus, AlertCircle, CalendarClock, Lock, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO, startOfDay, subDays, isSameDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "marketing", "seo", "research", "posting", "designing", "other"];
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
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { shiftStart, shiftEnd: resolvedShiftEnd, workingDays } = useWorkSettings();
  const overtimeEnabled = profile?.overtime_enabled ?? false;
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const today = getPKTDateString();

  // Fetch draft logs from database (cross-device sync)
  const { data: pendingLogs = [] } = useQuery({
    queryKey: ["my-draft-logs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("status", "draft")
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: logEditDays = 3 } = useQuery({
    queryKey: ["system-setting-log-edit-days"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "log_edit_window_days").maybeSingle();
      return data ? Number(data.value) : 3;
    },
  });

  const minDate = getMinDateStr(10);

  const { data: logsTotals = {} } = useQuery({
    queryKey: ["my-logs-totals-range", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, hours")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .gte("log_date", minDate);
      
      const totals: Record<string, number> = {};
      data?.forEach((l: any) => {
        totals[l.log_date] = (totals[l.log_date] || 0) + Number(l.hours);
      });
      return totals;
    },
    enabled: !!user?.id,
  });

  const getPrevWorkingDay = () => {
    let d = new Date(today + "T00:00:00");
    do {
      d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || (d.getDay() === 6 && workingDays === 5 && !overtimeEnabled));
    return format(d, "yyyy-MM-dd");
  };

  const prevWorkingDay = getPrevWorkingDay();

  const schema = z.object({
    project_id: z.string().min(1, "Please select a project").refine(v => v !== NO_PROJECT, "Please select a project"),
    category: z.string().min(1, "Category is required"),
    hours: z.number().min(0.25, "Min 0.25 hours").max(24, "Max 24 hours"),
    description: z.string().min(20, "Min 20 characters"),
    log_date: z.string().min(1, "Date is required").refine((v) => {
      const day = new Date(v + "T00:00:00").getDay();
      // Overtime users can log on any day (including weekends)
      if (overtimeEnabled) return true;
      if (day === 0) return false;
      if (day === 6 && workingDays === 5) return false;
      return true;
    }, "Cannot submit logs for this day").refine((v) => {
      const isToday = v === today;
      const isPrevWorking = v === prevWorkingDay;
      return isToday || isPrevWorking;
    }, "Only today and the previous working day are available for logs").refine((v) => {
      // Overtime users have no daily cap
      if (overtimeEnabled) return true;
      const total = logsTotals[v] || 0;
      return total < 24;
    }, "This day already has the maximum hours logged"),
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

  // Fetch submitted logs for the CURRENTLY SELECTED date in the form
  const { data: dateLogs = [] } = useQuery({
    queryKey: ["my-logs-date", user?.id, selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("log_date", selectedDate)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id && !!selectedDate,
  });

  const submittedHours = useMemo(() => dateLogs.reduce((sum, l) => sum + Number(l.hours), 0), [dateLogs]);
  const pendingHoursForSelectedDate = useMemo(() => 
    pendingLogs.filter((p: any) => p.log_date === selectedDate && p.id !== editId).reduce((sum: number, l: any) => sum + Number(l.hours), 0),
    [pendingLogs, selectedDate, editId]
  );
  
  const totalHoursForSelectedDate = submittedHours + pendingHoursForSelectedDate;
  const remainingFor8 = overtimeEnabled ? 24 : Math.max(0, 24 - totalHoursForSelectedDate);
  const isLocked = !overtimeEnabled && submittedHours > 0 && profile?.role !== "admin";

  const onAddLog = async (data: z.infer<typeof schema>) => {
    const currentHours = Number(data.hours);
    const maxDaily = 24;
    if (submittedHours + pendingHoursForSelectedDate + currentHours > maxDaily + 0.01 && profile?.role !== "admin") {
      toast.error(`You can only log up to ${maxDaily} hours per day. You have already logged ${submittedHours}h and have ${pendingHoursForSelectedDate}h pending.`);
      return;
    }

    try {
      if (editId) {
        // Update existing draft in database
        const { error } = await supabase.from("daily_logs").update({
          project_id: data.project_id === NO_PROJECT ? null : data.project_id || null,
          category: data.category,
          hours: data.hours,
          description: data.description,
          log_date: data.log_date,
        }).eq("id", editId).eq("status", "draft");
        if (error) throw error;
        setEditId(null);
        toast.success("Log updated");
      } else {
        // Insert new draft into database
        const { error } = await supabase.from("daily_logs").insert({
          user_id: user!.id,
          project_id: data.project_id === NO_PROJECT ? null : data.project_id || null,
          category: data.category,
          hours: data.hours,
          description: data.description,
          log_date: data.log_date,
          status: "draft",
          is_late: false,
          is_overtime: false,
        });
        if (error) throw error;
        toast.success("Log added to list");
      }
      queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
      form.reset({ ...form.getValues(), hours: 1, description: "" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEdit = (log: any) => {
    setEditId(log.id);
    form.reset({
      project_id: log.project_id || "",
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

  const removePendingLog = async (logId: string) => {
    try {
      const { error } = await supabase.from("daily_logs").delete().eq("id", logId).eq("status", "draft");
      if (error) throw error;
      if (editId === logId) cancelEdit();
      queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSubmitAll = async () => {
    if (pendingLogs.length === 0) return;
    setSubmitting(true);
    try {
      const nowPKTStr = getPKTISOString();
      const nowPKT = new Date(nowPKTStr);
      const todayStr = getPKTDateString();
      
      let isLate = false;
      if (resolvedShiftEnd && resolvedShiftEnd.includes(":")) {
        const todayDeadline = new Date(`${todayStr}T${resolvedShiftEnd}:00+05:00`);
        if (shiftStart && resolvedShiftEnd < shiftStart) {
          todayDeadline.setDate(todayDeadline.getDate() + 1);
        }
        isLate = nowPKT.getTime() > todayDeadline.getTime();
      }

      // Build per-log overtime flags
      const overtimeFlags: Record<string, boolean> = {};
      if (overtimeEnabled) {
        const logsByDate: Record<string, any[]> = {};
        pendingLogs.forEach((log: any) => {
          if (!logsByDate[log.log_date]) logsByDate[log.log_date] = [];
          logsByDate[log.log_date].push(log);
        });
        for (const [date, dLogs] of Object.entries(logsByDate)) {
          const existingTotal = logsTotals[date] || 0;
          let runningTotal = existingTotal;
          for (const log of dLogs) {
            const logHours = Number(log.hours);
            overtimeFlags[log.id] = runningTotal >= 8 || runningTotal + logHours > 8;
            runningTotal += logHours;
          }
        }
      }

      // Update each draft to submitted with computed fields
      for (const log of pendingLogs) {
        const { error } = await supabase.from("daily_logs").update({
          status: "submitted",
          is_late: isLate,
          is_overtime: overtimeFlags[log.id] || false,
          submitted_at: nowPKTStr,
        }).eq("id", log.id).eq("status", "draft");
        if (error) throw error;
      }

      // Auto clock out if employee has an active session
      const { data: openSession } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .is("clock_out", null)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      let clockedOut = false;
      if (openSession) {
        const { error: clockOutError } = await supabase
          .from("attendance")
          .update({ clock_out: nowPKTStr })
          .eq("id", openSession.id);
        if (clockOutError) throw clockOutError;

        await supabase.from("audit_logs").insert({
          actor_id: user!.id,
          action: "attendance.clocked_out",
          target_entity: "attendance",
          target_id: openSession.id,
          metadata: {
            clock_out: nowPKTStr,
            date: openSession.date,
            trigger: "log_submission",
          },
        });
        clockedOut = true;
      }

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "log.bulk_submitted",
        target_entity: "daily_logs",
        metadata: { count: pendingLogs.length }
      });

      if (clockedOut) {
        toast.success(`${pendingLogs.length} logs submitted and clocked out successfully`);
      } else {
        toast.success(`${pendingLogs.length} logs submitted successfully`);
      }

      form.reset({ project_id: "", category: "", hours: 1, description: "", log_date: today });
      queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs-date"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs-totals-range"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      if (clockedOut) {
        await queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
        await queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
        await queryClient.invalidateQueries({ queryKey: ["attendance-open-session"] });
      }
      setShowSubmitConfirm(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
            <div>
              <p className="font-medium text-black">{totalHoursForSelectedDate} of 8 hours total</p>
              {submittedHours > 0 && <p className="text-[10px] text-muted-foreground">({submittedHours}h already submitted)</p>}
            </div>
            {remainingHoursForTarget > 0 ? (
              <p className="text-muted-foreground">{remainingHoursForTarget}h remaining</p>
            ) : (
              <p className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Day Limit Reached</p>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
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
                  <Input type="number" step="0.25" min="0.25" className="bg-background" {...field} onChange={e => field.onChange(Number(e.target.value))} disabled={isLocked} max={24} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="log_date" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Log Date</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-background h-10",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isLocked}
                        >
                          {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(format(date, "yyyy-MM-dd"));
                            setIsCalendarOpen(false);
                          }
                        }}
                        disabled={(date) => {
                          const dateStr = format(date, "yyyy-MM-dd");
                          const day = date.getDay();
                          
                          // Overtime users can log on any day
                          if (!overtimeEnabled) {
                            // Disable Sunday
                            if (day === 0) return true;
                            // Disable Saturday if 5-day worker
                            if (day === 6 && workingDays === 5) return true;
                          }
                          
                          // Only Today and Previous Working Day are allowed
                          const isToday = dateStr === today;
                          const isPrevWorking = dateStr === prevWorkingDay;
                          if (!isToday && !isPrevWorking) return true;
                          
                          // Disable if already has 24+ hours (hard cap)
                          if ((logsTotals[dateStr] || 0) >= 24) return true;
                          
                          // Future dates (just in case)
                          if (date > new Date()) return true;

                          return false;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</FormLabel>
                <FormControl><Textarea {...field} rows={3} className="bg-background resize-none" placeholder="Explain your progress..." disabled={isLocked} /></FormControl>
                <div className="flex justify-between items-center px-1">
                  <FormMessage />
                  <span className={`text-[10px] font-mono ${descValue?.length < 20 ? "text-destructive" : "text-muted-foreground"}`}>{descValue?.length || 0} / 20 chars min</span>
                </div>
              </FormItem>
            )} />

            {isLocked ? (
              <div className="bg-muted p-6 rounded-xl border-2 border-dashed flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-primary/10 rounded-full"><Lock className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="font-bold">Daily Limit Reached</p>
                  <p className="text-sm text-muted-foreground">You have already submitted logs for {format(parseISO(selectedDate), "MMM do")}.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate("/logs/my")} className="rounded-button">Go to My Logs</Button>
              </div>
            ) : (
              <div className="flex justify-end gap-3 pt-2">
                {editId && (
                  <Button type="button" variant="ghost" onClick={cancelEdit} className="rounded-button">Cancel Edit</Button>
                )}
                <Button type="submit" className="rounded-button px-8" disabled={!overtimeEnabled && totalHoursForSelectedDate >= 24 && !editId}>
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
            {pendingLogs.map((log: any) => (
              <Card key={log.id} className="p-4 bg-muted border-primary/10 transition-all hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary" className="bg-primary border-primary/20">
                        {log.projects?.name || projects.find((p: any) => p.id === log.project_id)?.name || "Project"}
                      </Badge>
                      <Badge variant="secondary" className="capitalize text-[10px] bg-primary">{log.category.replace("_", " ")}</Badge>
                      <span className="text-sm font-bold text-black">
                        {formatHours(log.hours)}
                      </span>
                      <span className="text-sm text-muted-foreground font-mono">{format(parseISO(log.log_date), "MMM d, yyyy")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{log.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(log)} className="h-8 w-8 hover:text-primary"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removePendingLog(log.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
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
              <Card key={log.id} className={`p-4 border-none shadow-none ${log.is_overtime ? "bg-purple-50 border-l-4 border-purple-400" : "bg-muted"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      {log.projects?.name && <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">{log.projects.name}</Badge>}
                      <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">{log.category}</Badge>
                      <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                      {log.is_overtime && <Badge className="bg-purple-100 text-purple-700 text-[10px]">Overtime</Badge>}
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
        <p className="text-xs">
          {overtimeEnabled
            ? "Tip: Overtime is enabled for your account. You can log hours beyond 8h and submit logs on weekends. Hours above 8h per day are tracked as overtime."
            : "Tip: You can select a past date to submit logs you might have missed. You can submit multiple logs for the same day until you reach the daily limit."}
        </p>
      </div>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><Send className="h-5 w-5" />Final Submission</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-semibold text-foreground">Are you sure you want to submit all {pendingLogs.length} logs?</p>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-800 text-xs flex gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p><strong>Warning:</strong> This action is irreversible.</p>
                  <p>You will be automatically clocked out from your current attendance session when these logs are submitted.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitAll} className="rounded-button bg-primary hover:bg-primary/90 text-white">Confirm</AlertDialogAction>
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
