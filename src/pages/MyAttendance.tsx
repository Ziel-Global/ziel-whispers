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
  const { shiftStart, shiftEnd } = useWorkSettings();
  const [workMode, setWorkMode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);
  const [lateConfirmOpen, setLateConfirmOpen] = useState(false);
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

  // Today's attendance
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
        .select("log_date, is_late")
        .eq("user_id", user!.id)
        .gte("log_date", monthStart)
        .lte("log_date", monthEnd);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Group logs by date
  const logsByDate = useMemo(() => {
    const map: Record<string, { count: number; hasLate: boolean }> = {};
    monthLogs.forEach((l: any) => {
      if (!map[l.log_date]) map[l.log_date] = { count: 0, hasLate: false };
      map[l.log_date].count++;
      if (l.is_late) map[l.log_date].hasLate = true;
    });
    return map;
  }, [monthLogs]);

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
        actor_id: user!.id, action: "attendance.clock_in", target_entity: "attendance",
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
        actor_id: user!.id, action: "attendance.clock_out", target_entity: "attendance",
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
  const todayCompleted = !!todayRecord?.clock_out;
  const canClockIn = !hasOpenSession && !todayCompleted;

  // Calendar
  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const getRecordForDay = (d: Date) => monthRecords.find((r) => r.date === format(d, "yyyy-MM-dd"));
  const selectedRecord = selectedDay ? getRecordForDay(selectedDay) : null;

  const getDayColor = (d: Date) => {
    if (isWeekend(d)) return "bg-muted text-muted-foreground";
    const rec = getRecordForDay(d);
    if (!rec) {
      // Only show as absent (red) if the date is on or after join_date
      const dateStr = format(d, "yyyy-MM-dd");
      const joinDate = profile?.join_date;
      
      if (d < new Date() && isSameMonth(d, calMonth)) {
        if (joinDate && dateStr < joinDate) return ""; // Not employed yet
        return "bg-red-100 text-red-700";
      }
      return "";
    }
    if (rec.is_late) return "bg-yellow-100 text-yellow-700";
    if (rec.clock_in) return "bg-green-100 text-green-700";
    return "";
  };

  const getLogIndicator = (d: Date) => {
    if (isWeekend(d)) return null;
    const dateStr = format(d, "yyyy-MM-dd");
    const logInfo = logsByDate[dateStr];
    const isPast = d < new Date() && !isSameDay(d, new Date());

    if (!logInfo || logInfo.count === 0) {
      if (isPast) {
        const joinDate = profile?.join_date;
        if (joinDate && dateStr < joinDate) return null; // Not employed yet
        return { label: "No Log", color: "text-red-500" };
      }
      return null;
    }
    if (logInfo.hasLate) return { label: "Late", color: "text-amber-600" };
    return { label: "Logged", color: "text-green-600" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
        <Badge variant="outline" className="text-sm font-normal">
          Your Shift: {formatShiftTime(shiftStart)} – {formatShiftTime(shiftEnd)}
        </Badge>
      </div>

      {/* Late clock-in alert for today — dynamic duration */}
      {todayRecord && todayRecord.is_late && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            You're late by <strong>{formatLateness(todayRecord.minutes_late)}</strong>. Your shift starts at <strong>{formatShiftTime(shiftStart)}</strong>.
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
              <Button onClick={() => setClockOutConfirmOpen(true)} disabled={loading} variant="destructive" size="lg" className="rounded-button">
                <LogOut className="h-5 w-5 mr-2" />
                Clock Out
              </Button>
            </>
          )}

          {!hasOpenSession && todayCompleted && (
            <div className="text-center space-y-2">
              <Badge className="bg-muted text-muted-foreground">Session Complete</Badge>
              <p className="text-sm text-muted-foreground">
                {formatPKTTime(todayRecord!.clock_in!)} — {formatPKTTime(todayRecord!.clock_out!)}
                {" · "}
                {formatDuration(Math.floor((new Date(todayRecord!.clock_out!).getTime() - new Date(todayRecord!.clock_in!).getTime()) / 1000))}
              </p>
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
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
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
            <AlertDialogTitle>Are you sure you want to clock out?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. Once clocked out, you cannot undo this or modify your clock-out time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClockOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Clock Out
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
                className={`min-h-[44px] rounded text-sm font-medium transition-colors flex flex-col items-center justify-center gap-0.5 ${getDayColor(d)} ${selectedDay && isSameDay(d, selectedDay) ? "ring-2 ring-primary" : ""} hover:ring-1 hover:ring-border`}
              >
                <span>{d.getDate()}</span>
                {indicator && <span className={`text-[9px] leading-none font-medium ${indicator.color}`}>{indicator.label}</span>}
              </button>
            );
          })}
        </div>

        {selectedRecord && (
          <div className="mt-4 p-3 bg-muted rounded-md space-y-1 text-sm">
            <p>
              <strong>Clock In:</strong> {selectedRecord.clock_in ? formatPKTTime(selectedRecord.clock_in) : "—"}
              {selectedRecord.is_late && (
                <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-[10px]">
                  Late by {formatLateness(selectedRecord.minutes_late)}
                </Badge>
              )}
            </p>
            <p><strong>Clock Out:</strong> {selectedRecord.clock_out ? formatPKTTime(selectedRecord.clock_out) : "—"}</p>
            {selectedRecord.clock_in && selectedRecord.clock_out && (
              <p><strong>Duration:</strong> {formatDuration(Math.floor((new Date(selectedRecord.clock_out).getTime() - new Date(selectedRecord.clock_in).getTime()) / 1000))}</p>
            )}
            <p><strong>Mode:</strong> {selectedRecord.work_mode || "—"}</p>
            {selectedRecord.notes && <p><strong>Notes:</strong> {selectedRecord.notes}</p>}
            {/* Log status for selected day */}
            {(() => {
              const dateStr = format(selectedDay!, "yyyy-MM-dd");
              const logInfo = logsByDate[dateStr];
              if (!logInfo || logInfo.count === 0) {
                const isPast = selectedDay! < new Date();
                if (isPast) return <p><strong>Log:</strong> <span className="text-red-600">No log submitted</span></p>;
                return null;
              }
              if (logInfo.hasLate) return <p><strong>Log:</strong> <span className="text-amber-600">Submitted late</span></p>;
              return <p><strong>Log:</strong> <span className="text-green-600">Submitted on time</span></p>;
            })()}
          </div>
        )}
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
