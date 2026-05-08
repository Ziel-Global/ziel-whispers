import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay, addMonths, subMonths } from "date-fns";
import { formatPKTTime, formatLateness } from "@/hooks/useWorkSettings";

interface AttendanceCalendarProps {
  userId: string;
  createdAt?: string;
}

export function AttendanceCalendar({ userId, createdAt }: AttendanceCalendarProps) {
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const monthStart = format(startOfMonth(calMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(calMonth), "yyyy-MM-dd");

  const { data: monthRecords = [] } = useQuery({
    queryKey: ["attendance-month", userId, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: monthLogs = [] } = useQuery({
    queryKey: ["month-logs", userId, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, is_late")
        .eq("user_id", userId)
        .gte("log_date", monthStart)
        .lte("log_date", monthEnd);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: selectedDayLogs = [] } = useQuery({
    queryKey: ["day-logs", userId, selectedDay],
    queryFn: async () => {
      if (!selectedDay) return [];
      const dateStr = format(selectedDay, "yyyy-MM-dd");
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", userId)
        .eq("log_date", dateStr);
      return data || [];
    },
    enabled: !!userId && !!selectedDay,
  });

  const logsByDate = useMemo(() => {
    const map: Record<string, { count: number; hasLate: boolean }> = {};
    monthLogs.forEach((l) => {
      if (!map[l.log_date]) map[l.log_date] = { count: 0, hasLate: false };
      map[l.log_date].count++;
      if (l.is_late) map[l.log_date].hasLate = true;
    });
    return map;
  }, [monthLogs]);

  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });

  const getLogIndicator = (d: Date) => {
    if (isWeekend(d)) return null;
    const dateStr = format(d, "yyyy-MM-dd");
    const logInfo = logsByDate[dateStr];
    const isPast = d < new Date() && !isSameDay(d, new Date());

    if (!logInfo || logInfo.count === 0) {
      if (isPast) {
        const createdAtDate = createdAt ? createdAt.split("T")[0] : null;
        if (createdAtDate && dateStr <= createdAtDate) return null;
        return { label: "No Log - Absent", color: "text-red-500" };
      }
      return null;
    }
    if (logInfo.hasLate) return { label: "Late Submission", color: "text-amber-600" };
    return { label: "Logged", color: "text-green-600" };
  };

  const getDayColor = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const rec = monthRecords.find((r) => r.date === dateStr);
    if (!rec) return "";
    if (rec.clock_in && !rec.clock_out) return "bg-green-50 text-green-700";
    if (rec.is_late) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-800";
  };

  const selectedRecord = useMemo(() => {
    if (!selectedDay) return null;
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    return monthRecords.find((r) => r.date === dateStr);
  }, [selectedDay, monthRecords]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-4">
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

      {selectedDay && (
        <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-center justify-between border-b pb-2 border-black/10">
            <h4 className="font-bold">{format(selectedDay, "MMMM d, yyyy")}</h4>
            {selectedRecord?.is_late && (
              <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">
                Late Clock-in ({formatLateness(selectedRecord.minutes_late)})
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p><strong>Clock In:</strong> {selectedRecord?.clock_in ? formatPKTTime(selectedRecord.clock_in) : "—"}</p>
              <p><strong>Clock Out:</strong> {selectedRecord?.clock_out ? formatPKTTime(selectedRecord.clock_out) : "—"}</p>
              {selectedRecord?.clock_in && selectedRecord?.clock_out && (
                <p><strong>Duration:</strong> {formatDuration(Math.floor((new Date(selectedRecord.clock_out).getTime() - new Date(selectedRecord.clock_in).getTime()) / 1000))}</p>
              )}
              <p><strong>Work Mode:</strong> <span className="capitalize">{selectedRecord?.work_mode || "—"}</span></p>
            </div>
            
            <div className="space-y-2">
              <p className="font-bold text-xs uppercase text-muted-foreground tracking-wider">Daily Logs</p>
              {selectedDayLogs.length === 0 ? (
                <p className="text-muted-foreground italic">No logs submitted</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayLogs.map((log: any, idx: number) => (
                    <div key={log.id} className="p-2 bg-white/50 rounded border border-black/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-xs">Log {selectedDayLogs.length > 1 ? idx + 1 : ""}</span>
                        {log.is_late && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] hover:bg-amber-100 border-amber-200">
                            Late Submission
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] mt-1 line-clamp-2">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                         <span>{log.projects?.name}</span>
                         <span>•</span>
                         <span>{log.hours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
