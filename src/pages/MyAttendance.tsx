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
import { AttendanceCalendar } from "@/components/AttendanceCalendar";

export default function MyAttendancePage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { shiftStart, shiftEnd } = useWorkSettings();
  const [workMode, setWorkMode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calMonth, setCalMonth] = useState(new Date());
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

  const onClockOutClick = () => {
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
  const todayCompleted = !!todayRecord?.clock_out;
  const canClockIn = !hasOpenSession && !todayCompleted;

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
                  <Button onClick={onClockOutClick} disabled={loading} variant="destructive" size="lg" className="rounded-button">
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

      <Card className="p-6">
        <AttendanceCalendar userId={user!.id} createdAt={profile?.created_at} />
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
