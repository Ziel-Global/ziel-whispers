import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, isSameDay, addMonths, subMonths } from "date-fns";

export default function MyAttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [workMode, setWorkMode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const today = new Date().toISOString().split("T")[0];

  // Today's attendance
  const { data: todayRecord } = useQuery({
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

  // Live timer
  useEffect(() => {
    if (!todayRecord?.clock_in || todayRecord?.clock_out) return;
    const start = new Date(todayRecord.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [todayRecord]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleClockIn = async () => {
    if (!workMode) { toast.error("Select work mode first"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("attendance").insert({
        user_id: user!.id,
        date: today,
        clock_in: new Date().toISOString(),
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
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClockOut = async () => {
    if (!todayRecord) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("attendance")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", todayRecord.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user!.id, action: "attendance.clock_out", target_entity: "attendance",
      });
      toast.success("Clocked out successfully");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;
  const hasClockedOut = !!todayRecord?.clock_out;

  // Calendar
  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const getRecordForDay = (d: Date) => monthRecords.find((r) => r.date === format(d, "yyyy-MM-dd"));
  const selectedRecord = selectedDay ? getRecordForDay(selectedDay) : null;

  const getDayColor = (d: Date) => {
    if (isWeekend(d)) return "bg-muted text-muted-foreground";
    const rec = getRecordForDay(d);
    if (!rec) {
      if (d < new Date() && isSameMonth(d, calMonth)) return "bg-red-100 text-red-700";
      return "";
    }
    if (rec.clock_in) return "bg-green-100 text-green-700";
    return "";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>

      {/* Clock In/Out Widget */}
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>

          {isClockedIn && (
            <>
              <div className="text-5xl font-mono font-bold text-foreground">{formatDuration(elapsed)}</div>
              <Badge className="bg-green-100 text-green-800">Active Session · {todayRecord?.work_mode}</Badge>
              <Button onClick={handleClockOut} disabled={loading} variant="destructive" size="lg" className="rounded-button">
                <LogOut className="h-5 w-5 mr-2" />
                Clock Out
              </Button>
            </>
          )}

          {hasClockedOut && (
            <div className="text-center space-y-2">
              <Badge className="bg-muted text-muted-foreground">Session Complete</Badge>
              <p className="text-sm text-muted-foreground">
                {format(new Date(todayRecord!.clock_in!), "h:mm a")} — {format(new Date(todayRecord!.clock_out!), "h:mm a")}
                {" · "}
                {formatDuration(Math.floor((new Date(todayRecord!.clock_out!).getTime() - new Date(todayRecord!.clock_in!).getTime()) / 1000))}
              </p>
            </div>
          )}

          {!todayRecord && (
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
        </div>
      </Card>

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
          {days.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => setSelectedDay(d)}
              className={`h-9 rounded text-sm font-medium transition-colors ${getDayColor(d)} ${selectedDay && isSameDay(d, selectedDay) ? "ring-2 ring-primary" : ""} hover:ring-1 hover:ring-border`}
            >
              {d.getDate()}
            </button>
          ))}
        </div>

        {selectedRecord && (
          <div className="mt-4 p-3 bg-muted rounded-md space-y-1 text-sm">
            <p><strong>Clock In:</strong> {selectedRecord.clock_in ? format(new Date(selectedRecord.clock_in), "h:mm a") : "—"}</p>
            <p><strong>Clock Out:</strong> {selectedRecord.clock_out ? format(new Date(selectedRecord.clock_out), "h:mm a") : "—"}</p>
            {selectedRecord.clock_in && selectedRecord.clock_out && (
              <p><strong>Duration:</strong> {formatDuration(Math.floor((new Date(selectedRecord.clock_out).getTime() - new Date(selectedRecord.clock_in).getTime()) / 1000))}</p>
            )}
            <p><strong>Mode:</strong> {selectedRecord.work_mode || "—"}</p>
            {selectedRecord.notes && <p><strong>Notes:</strong> {selectedRecord.notes}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
