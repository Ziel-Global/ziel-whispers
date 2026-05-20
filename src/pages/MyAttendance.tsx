import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkSettings, formatShiftTime, formatLateness, getPKTDateString, getPKTISOString, formatPKTTime, getLatenessInfo } from "@/hooks/useWorkSettings";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, isSameDay, addMonths, subMonths } from "date-fns";



export default function MyAttendancePage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { shiftStart, shiftEnd, workingDays } = useWorkSettings();
  const [workMode, setWorkMode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);
  const [lateConfirmOpen, setLateConfirmOpen] = useState(false);
  const [earlyClockOutInfo, setEarlyClockOutInfo] = useState<{ isEarly: boolean; remainingText: string } | null>(null);
  const today = getPKTDateString();

  // Check for any open (unclosed) attendance session
  const { data: openSession, isLoading: isLoadingOpen } = useQuery({
    queryKey: ["attendance-open-session", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .is("clock_out", null)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Today's attendance record
  const { data: todayRecord, isLoading: isLoadingToday } = useQuery({
    queryKey: ["attendance-today", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .eq("date", today)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Monthly attendance
  const monthStart = format(startOfMonth(calMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(calMonth), "yyyy-MM-dd");
  const { data: monthRecords = [] } = useQuery({
    queryKey: ["attendance-month", user?.id, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Monthly logs for log status indicators
  const { data: monthLogs = [] } = useQuery({
    queryKey: ["my-month-logs", user?.id, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, is_late, hours, submitted_at")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .gte("log_date", monthStart)
        .lte("log_date", monthEnd);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Monthly approved leave requests
  const { data: monthLeaves = [] } = useQuery({
    queryKey: ["my-month-leaves", user?.id, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, leave_types(name)")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const getLeaveForDay = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    return monthLeaves.find((l: any) => dateStr >= l.start_date && dateStr <= l.end_date);
  };

  // Monthly approved remote work requests
  const { data: monthWfh = [] } = useQuery({
    queryKey: ["my-wfh-requests", user?.id, "month", monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("remote_work_requests")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const getWfhForDay = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    return monthWfh.find((w: any) => w.date === dateStr);
  };

  // Check if there is an approved WFH request for today
  const { data: todayWfh } = useQuery({
    queryKey: ["my-wfh-today", user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("remote_work_requests")
        .select("id")
        .eq("user_id", user!.id)
        .eq("date", today)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const hasApprovedWfh = !!todayWfh;

  // Group logs by date
  const logsByDate = useMemo(() => {
    const map: Record<string, { count: number; hasLate: boolean; totalHours: number; lastSubmittedAt: string | null }> = {};
    monthLogs.forEach((l: any) => {
      if (!map[l.log_date]) map[l.log_date] = { count: 0, hasLate: false, totalHours: 0, lastSubmittedAt: null };
      map[l.log_date].count++;
      if (l.is_late) map[l.log_date].hasLate = true;
      map[l.log_date].totalHours += Number(l.hours);
      if (!map[l.log_date].lastSubmittedAt || new Date(l.submitted_at) > new Date(map[l.log_date].lastSubmittedAt)) {
        map[l.log_date].lastSubmittedAt = l.submitted_at;
      }
    });
    return map;
  }, [monthLogs]);

  // Logs for the selected day (detailed)
  const { data: selectedDayLogs = [] } = useQuery({
    queryKey: ["my-day-logs", user?.id, selectedDay],
    queryFn: async () => {
      if (!selectedDay) return [];
      const dateStr = format(selectedDay, "yyyy-MM-dd");
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("log_date", dateStr)
        .eq("status", "submitted");
      return data || [];
    },
    enabled: !!user?.id && !!selectedDay,
  });

  // Live timer
  useEffect(() => {
    if (!openSession?.clock_in) return;
    const start = new Date(openSession.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((new Date().getTime() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSession]);

  const formatDuration = (secs: number) => {
    const s = Math.max(0, secs);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const performClockIn = async () => {
    setLoading(true);
    setLateConfirmOpen(false);
    try {
      const { error } = await supabase.from("attendance").insert({
        user_id: user!.id,
        date: today,
        clock_in: getPKTISOString(),
        work_mode: workMode,
        notes: notes || null,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "attendance.clocked_in",
        target_entity: "attendance",
        metadata: {
          clock_in: getPKTISOString(),
          work_mode: workMode,
          notes: notes || null,
          date: today,
        },
      });
      toast.success("Clocked in successfully");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-open-session"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClockIn = async () => {
    if (!workMode) { toast.error("Select work mode first"); return; }

    const { isLate } = getLatenessInfo(shiftStart);
    if (isLate) {
      setLateConfirmOpen(true);
      return;
    }

    await performClockIn();
  };

  const getEarlyClockOutData = () => {
    if (!shiftEnd) return { isEarly: false, remainingText: "" };
    
    const parts = shiftEnd.split(":");
    if (parts.length < 2) return { isEarly: false, remainingText: "" };
    
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const pktNow = new Date(utc + (3600000 * 5));
    
    const shiftEndTime = new Date(pktNow);
    shiftEndTime.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    
    const diffMs = shiftEndTime.getTime() - pktNow.getTime();
    if (diffMs > 0) {
      const totalMinutes = Math.floor(diffMs / 60000);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      
      let text = "";
      if (hrs > 0) text += `${hrs} hour${hrs > 1 ? "s" : ""} `;
      if (mins > 0) text += `${mins} minute${mins > 1 ? "s" : ""}`;
      
      return { isEarly: true, remainingText: text.trim() };
    }
    
    return { isEarly: false, remainingText: "" };
  };

  const onClockOutClick = async () => {
    const info = getEarlyClockOutData();
    if (info.isEarly) {
      setEarlyClockOutInfo(info);
      setClockOutConfirmOpen(true);
    } else {
      handleClockOut();
    }
  };

  const handleClockOut = async () => {
    if (!openSession) return;
    setLoading(true);
    setClockOutConfirmOpen(false);
    try {
      const { error } = await supabase.from("attendance")
        .update({ clock_out: getPKTISOString() })
        .eq("id", openSession.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "attendance.clocked_out",
        target_entity: "attendance",
        target_id: openSession.id,
        metadata: {
          clock_out: getPKTISOString(),
          date: today,
        },
      });
      toast.success("Clocked out successfully");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-open-session"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const hasOpenSession = !!openSession?.clock_in && !openSession?.clock_out;
  const isOpenSessionFromDifferentDay = hasOpenSession && openSession?.date !== today;
  const canClockIn = !hasOpenSession && !todayRecord;

  // Calendar
  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const getRecordsForDay = (d: Date) => monthRecords.filter((r) => r.date === format(d, "yyyy-MM-dd"));
  const selectedRecords = selectedDay ? getRecordsForDay(selectedDay) : [];

  const getDayColor = (d: Date) => {
    const day = d.getDay();
    const isSun = day === 0;
    const isSat = day === 6;
    if (isSun || (isSat && workingDays === 5)) return "bg-muted text-muted-foreground";

    const leave = getLeaveForDay(d);
    const recs = getRecordsForDay(d);

    if (leave) {
      if (leave.hours) {
        if (recs.length > 0) {
          return "bg-blue-100 text-blue-700";
        }
        return "bg-purple-100 text-purple-700";
      }
      return "bg-purple-100 text-purple-700";
    }

    if (recs.length === 0) {
      const wfh = getWfhForDay(d);
      if (wfh) return "bg-indigo-100 text-indigo-700";

      // Only show as absent (red) if the date is strictly AFTER the account creation date.
      // created_at is the definitive boundary — join_date can be backdated by admins.
      const dateStr = format(d, "yyyy-MM-dd");
      const createdAtDate = profile?.created_at ? profile.created_at.split("T")[0] : null;

      if (d < new Date() && !isSameDay(d, new Date()) && isSameMonth(d, calMonth)) {
        if (createdAtDate && dateStr <= createdAtDate) return ""; // Account didn't exist yet
        return "bg-red-100 text-red-700";
      }
      return "";
    }
    const isLate = recs.some(r => r.is_late);
    if (isLate) return "bg-yellow-100 text-yellow-700";
    if (recs.some(r => !!r.clock_in)) return "bg-green-100 text-green-700";
    return "";
  };

  const getLogIndicator = (d: Date) => {
    const day = d.getDay();
    const isSun = day === 0;
    const isSat = day === 6;
    if (isSun || (isSat && workingDays === 5)) return null;
    const dateStr = format(d, "yyyy-MM-dd");
    const logInfo = logsByDate[dateStr];
    const isPast = d < new Date() && !isSameDay(d, new Date());
    const isFuture = d > new Date() && !isSameDay(d, new Date());

    if (isFuture) return null;

    // Account boundary check
    const createdAtDate = profile?.created_at ? profile.created_at.split("T")[0] : null;
    if (createdAtDate && dateStr < createdAtDate) return null;

    const leave = getLeaveForDay(d);
    if (leave) {
      if (!leave.hours) {
        return { label: leave.leave_types?.name || "On Leave", color: "text-purple-600" };
      } else {
        const recs = getRecordsForDay(d);
        if (recs.length > 0) {
          const workedSeconds = recs.reduce((acc, s) => {
            if (!s.clock_in) return acc;
            const end = s.clock_out ? new Date(s.clock_out) : new Date();
            const start = new Date(s.clock_in);
            return acc + Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
          }, 0);
          const workedHours = (workedSeconds / 3600).toFixed(1);
          return { label: `Partial Day — ${workedHours} hrs worked, ${leave.hours} hrs on leave`, color: "text-blue-600" };
        }
        return { label: `Half Day Leave — ${leave.hours} hours`, color: "text-purple-600" };
      }
    }

    const recs = getRecordsForDay(d);
    const wfh = getWfhForDay(d);
    if (recs.length === 0 && wfh) {
      return { label: "Work From Home", color: "text-indigo-600" };
    }

    if (!logInfo || logInfo.count === 0) {
      if (isPast) {
        return { label: "Missed \u2014 Day marked as absent", color: "text-red-500" };
      }
      return { label: "Missed", color: "text-red-500" };
    }

    const statusPrefix = logInfo.hasLate ? "Submitted late" : "Submitted on time";
    const timeStr = logInfo.lastSubmittedAt ? formatPKTTime(logInfo.lastSubmittedAt) : "";
    return { label: `${statusPrefix} \u2014 Submitted at ${timeStr}`, color: logInfo.hasLate ? "text-amber-600" : "text-green-600" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
        <Badge variant="outline" className="text-sm font-normal">
          Your Shift: {formatShiftTime(shiftStart)} – {formatShiftTime(shiftEnd)}
        </Badge>
      </div>

      {/* Late clock-in alert for today */}
      {todayRecord?.is_late && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            You were late by <strong>{formatLateness(todayRecord.minutes_late)}</strong>. Your shift starts at <strong>{formatShiftTime(shiftStart)}</strong>.
          </p>
        </div>
      )}

      {/* Clock In/Out Widget */}
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          {(isLoadingOpen || isLoadingToday) ? (
            <div className="flex flex-col items-center gap-4 w-full py-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-10 w-full max-w-xs" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p>

              {hasOpenSession && (
                <>
                  {isOpenSessionFromDifferentDay && (
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md p-3 w-full max-w-md">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                      <p className="text-sm text-yellow-800">
                        You have an open session from <strong>{formatPKTTime(openSession!.clock_in!)} on {format(new Date(openSession!.clock_in!), "MMM d")}</strong>. Please clock out to close it.
                      </p>
                    </div>
                  )}
                  <div className="text-5xl font-mono font-bold text-foreground">{formatDuration(elapsed)}</div>
                  <Badge className="bg-green-100 text-green-800">Active Session · {openSession?.work_mode}</Badge>
                </>
              )}

              {!hasOpenSession && todayRecord && (
                <div className="w-full max-w-md text-center space-y-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Clocked Out
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {formatPKTTime(todayRecord.clock_in!)} — {todayRecord.clock_out ? formatPKTTime(todayRecord.clock_out) : "—"}
                  </p>
                  {todayRecord.clock_in && todayRecord.clock_out && (
                    <p className="text-sm font-medium">
                      Duration: {formatDuration(Math.floor((new Date(todayRecord.clock_out).getTime() - new Date(todayRecord.clock_in).getTime()) / 1000))}
                    </p>
                  )}
                </div>
              )}

              {canClockIn && (
                <>
                  <Clock className="h-12 w-12 text-muted-foreground" />
                  <div className="w-full max-w-xs space-y-3">
                    <div className="space-y-1">
                      <Label>Work Mode *</Label>
                      <Select value={workMode} onValueChange={setWorkMode}>
                        <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onsite">Onsite</SelectItem>
                          <SelectItem value="remote" disabled={!hasApprovedWfh}>Remote</SelectItem>
                        </SelectContent>
                      </Select>
                      {!hasApprovedWfh && (
                        <p className="text-[11px] text-muted-foreground flex items-center mt-1">
                          <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
                          Work From Home request required to clock in remotely
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Notes (optional)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes…" rows={2} />
                    </div>
                    <Button onClick={handleClockIn} disabled={loading} size="lg" className="w-full rounded-button">
                      <LogIn className="h-5 w-5 mr-2" />
                      Clock In
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Clock Out Confirmation Dialog */}
      <AlertDialog open={clockOutConfirmOpen} onOpenChange={setClockOutConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Early Clock Out Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>You are clocking out before your shift officially ends.</p>
              <div className="p-3 bg-red-50 border border-red-100 rounded text-red-900 font-medium">
                You still have <strong>{earlyClockOutInfo?.remainingText}</strong> remaining in your shift.
              </div>
              <p className="text-xs text-muted-foreground">
                This action is irreversible and will be recorded as an early departure.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClockOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clock Out Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Calendar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="font-semibold">{format(calMonth, "MMMM yyyy")}</h3>
          <Button variant="ghost" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((d) => {
            const indicator = getLogIndicator(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDay(d)}
                className={`min-h-[60px] p-1 rounded text-sm font-medium transition-colors flex flex-col items-center justify-center gap-0.5 ${getDayColor(d)} ${selectedDay && isSameDay(d, selectedDay) ? "ring-2 ring-primary" : ""} hover:ring-1 hover:ring-border`}
              >
                <span>{d.getDate()}</span>
                {indicator && <span className={`text-[8px] leading-[1.1] font-medium text-center px-0.5 ${indicator.color}`}>{indicator.label}</span>}
              </button>
            );
          })}
        </div>

        {selectedDay && (() => {
          const leave = getLeaveForDay(selectedDay);
          const wfh = getWfhForDay(selectedDay);
          const hasSessions = selectedRecords.length > 0;
          const indicator = getLogIndicator(selectedDay);
          
          if (!leave && !hasSessions && !wfh) {
            return (
              <div className="mt-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
                No attendance sessions or leave requests for {format(selectedDay, "MMM d, yyyy")}.
              </div>
            );
          }

          return (
            <div className="mt-4 space-y-4">
              <p className="text-sm font-semibold">Details for {format(selectedDay, "MMM d, yyyy")}</p>
              
              {leave && (
                <div className="p-3 border border-purple-100 bg-purple-50/30 rounded-md space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-700">Status: On Leave</span>
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
                      {leave.leave_types?.name || "Leave"}
                    </Badge>
                  </div>
                  {leave.hours ? (
                    <p className="text-xs text-purple-600"><strong>Hours Taken:</strong> {leave.hours} hours (Half Day Leave)</p>
                  ) : (
                    <p className="text-xs text-purple-600">Full Day Leave</p>
                  )}
                  {leave.reason && (
                    <p className="text-xs text-purple-700 italic">" {leave.reason} "</p>
                  )}
                </div>
              )}

              {wfh && !hasSessions && (
                <div className="p-3 border border-indigo-100 bg-indigo-50/30 rounded-md space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-700">Status: Approved Work From Home</span>
                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none">
                      Remote Work
                    </Badge>
                  </div>
                  {wfh.reason && (
                    <p className="text-xs text-indigo-650 italic mt-1">" {wfh.reason} "</p>
                  )}
                </div>
              )}

              {hasSessions && (
                <div className="space-y-3">
                  {selectedRecords.map((rec) => (
                    <div key={rec.id} className="p-3 bg-muted rounded-md space-y-1 text-sm relative">
                      <Badge variant="outline" className="absolute top-3 right-3 text-[10px] capitalize">{rec.work_mode}</Badge>
                      <p><strong>Clock In:</strong> {formatPKTTime(rec.clock_in!)}</p>
                      <p><strong>Clock Out:</strong> {rec.clock_out ? formatPKTTime(rec.clock_out) : "Active"}</p>
                      {rec.clock_in && (
                        <p>
                          <strong>Duration:</strong>{" "}
                          {formatDuration(
                            Math.floor(
                              ((rec.clock_out ? new Date(rec.clock_out) : new Date()).getTime() -
                                new Date(rec.clock_in).getTime()) /
                                1000
                            )
                          )}
                          {!rec.clock_out && " (so far)"}
                        </p>
                      )}
                      {rec.is_late && (
                        <p className="text-amber-600 font-medium">⚠️ Late by {formatLateness(rec.minutes_late)}</p>
                      )}
                      {rec.notes && <p><strong>Notes:</strong> {rec.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const day = selectedDay.getDay();
                const isSun = day === 0;
                const isSat = day === 6;
                
                if (isSun || (isSat && workingDays === 5)) {
                  return <p className="text-xs text-muted-foreground italic">Weekend (No log expected)</p>;
                }

                if (!indicator) return null;

                return (
                  <div className="pt-2 border-t flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Daily Log Status:</span>
                    <span className={`${indicator.color} font-medium`}>{indicator.label.split(" \u2014 ")[0]}</span>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </Card>

      {/* Late Clock-in Confirmation */}
      <AlertDialog open={lateConfirmOpen} onOpenChange={setLateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Late Clock-in Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are clocking in late (exceeding the 15-minute grace period). Your shift starts at <strong>{formatShiftTime(shiftStart)}</strong>.
              <br /><br />
              Are you sure you want to proceed? This will be recorded as a late arrival.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performClockIn} className="bg-yellow-600 hover:bg-yellow-700">
              Confirm Late Clock-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
