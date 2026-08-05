import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Pencil, AlertTriangle, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { formatLateness, getPKTDateString, formatPKTTime, isAttendanceLate } from "@/hooks/useWorkSettings";
import { cn } from "@/lib/utils";

export default function AttendanceAdminPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getPKTDateString());
  const [statusFilter, setStatusFilter] = useState("present");
  const [workModeFilter, setWorkModeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editWorkMode, setEditWorkMode] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["admin-attendance", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, users!attendance_user_id_fkey(full_name, department, email, is_oversight, shift_start, has_custom_shift)")
        .eq("date", selectedDate)
        .order("clock_in", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: openSessions = [] } = useQuery({
    queryKey: ["admin-open-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, users!attendance_user_id_fkey(full_name, department, is_oversight)")
        .is("clock_out", null)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activeUsers = [] } = useQuery({
    queryKey: ["admin-active-users", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, department, is_oversight, shift_start, has_custom_shift")
        .eq("status", "active")
        .lte("join_date", selectedDate);
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (statusFilter === "absent") {
      const userIdsWithAttendance = new Set(records.map((r: any) => r.user_id));
      return activeUsers
        .filter((u: any) => !userIdsWithAttendance.has(u.id))
        .filter((u: any) => {
          if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            if (!(u.full_name || "").toLowerCase().includes(q)) return false;
          }
          return true;
        })
        .map((u: any) => ({
          user_id: u.id,
          users: u,
          clock_in: null,
          clock_out: null,
          work_mode: null,
          notes: null,
          is_late: false,
          minutes_late: 0,
          hours_late: 0,
          date: selectedDate,
          id: "absent-" + u.id,
          auto_clocked_out: false,
          auto_clockout_notes: null,
        }))
        .sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""));
    }

    return records.filter((r: any) => {
      if (workModeFilter !== "all" && (r.work_mode || "").toLowerCase() !== workModeFilter) return false;
      if (statusFilter === "present") {
        if (!r.clock_in) return false;
      }
      if (statusFilter === "late") {
        if (!r.clock_in) return false;
        if (!r.is_late) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!(r.users?.full_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""));
  }, [records, activeUsers, statusFilter, workModeFilter, searchQuery, selectedDate]);

  const lateCount = useMemo(() => filtered.filter((r: any) => r.clock_in && r.is_late).length, [filtered]);

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    const end = clockOut ? new Date(clockOut) : new Date();
    const secs = Math.max(0, Math.floor((end.getTime() - new Date(clockIn).getTime()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m${!clockOut ? " (so..." : ""}`;
  };

  const to12Hour = (time24: string) => {
    const [h, m] = time24.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  const openEdit = (rec: any) => {
    setEditRecord(rec);
    setEditClockIn(rec.clock_in ? format(new Date(rec.clock_in), "HH:mm") : "");
    setEditClockOut(rec.clock_out ? format(new Date(rec.clock_out), "HH:mm") : "");
    setEditWorkMode(rec.work_mode || "onsite");
    setEditNotes(rec.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const dateStr = editRecord.date;
      const clockIn = editClockIn ? `${dateStr}T${editClockIn}:00+05:00` : editRecord.clock_in;
      const clockOut = editClockOut ? `${dateStr}T${editClockOut}:00+05:00` : null;

      let isLate = false, minutesLate = 0, hoursLate = 0;
      if (clockIn && clockIn !== editRecord.clock_in) {
        const dayOfWeek = new Date(clockIn).getDay();
        const [userRes, settingsRes] = await Promise.all([
          supabase.from("users").select("shift_start, has_custom_shift, working_days").eq("id", editRecord.user_id).single(),
          supabase.from("system_settings").select("key, value"),
        ]);
        const settings = settingsRes.data || [];
        const graceMinutes = Number(settings.find((s: any) => s.key === "late_grace_minutes")?.value || 15);
        const defaultShiftStart = settings.find((s: any) => s.key === "default_shift_start")?.value || "09:00";
        const workingDays = Number((userRes.data as any)?.working_days || 5);

        if (!(dayOfWeek === 0 || (dayOfWeek === 6 && workingDays === 5))) {
          const shiftStart = (userRes.data as any)?.has_custom_shift && (userRes.data as any)?.shift_start
            ? (userRes.data as any).shift_start
            : defaultShiftStart;
          const shiftStartTime = new Date(`${dateStr}T${shiftStart}:00+05:00`);
          const diffMs = new Date(clockIn).getTime() - shiftStartTime.getTime();
          const total = Math.max(0, Math.floor(diffMs / 60000));
          if (total > graceMinutes) {
            isLate = true;
            minutesLate = total;
            hoursLate = Math.floor(total / 60);
          }
        }
      }

      const { error } = await supabase.from("attendance").update({
        clock_in: clockIn,
        clock_out: clockOut,
        work_mode: editWorkMode,
        notes: editNotes || null,
        edited_by: user!.id,
        is_late: isLate,
        minutes_late: minutesLate,
        hours_late: hoursLate,
      }).eq("id", editRecord.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "attendance.edited",
        target_entity: "attendance",
        target_id: editRecord.id,
        metadata: {
          employee: editRecord.users?.full_name || editRecord.user_id,
          date: editRecord.date,
          new_clock_in: clockIn,
          new_clock_out: clockOut || null,
          work_mode: editWorkMode,
          notes: editNotes || null,
        },
      });

      toast.success("Attendance updated");
      setEditRecord(null);
      queryClient.invalidateQueries({ queryKey: ["admin-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["admin-open-sessions"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const header = "Employee,Department,Clock In,Clock Out,Duration,Work Mode,Late,Minutes Late,Notes\n";
    const rows = filtered.map((r: any) => {
      const name = r.users?.full_name || "";
      const dept = r.users?.department || "";
      const ci = r.clock_in ? formatPKTTime(r.clock_in) : "";
      const co = r.clock_out ? formatPKTTime(r.clock_out) : "";
      const dur = r.clock_in ? formatDuration(r.clock_in, r.clock_out) : "";
      return `"${name}","${dept}","${ci}","${co}","${dur}","${r.work_mode || ""}","${r.is_late ? "Yes" : "No"}","${r.minutes_late ?? 0}","${r.notes || ""}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
  };

  const today = getPKTDateString();
  const staleOpenSessions = openSessions.filter((s: any) => s.date < today);

  // Reusable orange filter classes
  const filterTriggerClass = cn(
    "h-10 text-[13px] font-medium text-[#09090B] shadow-sm transition-colors bg-white border-[#E4E4E7]",
    "hover:border-[#EC6824] hover:bg-[#FFF4EA]",
    "focus:border-[#EC6824] focus:ring-2 focus:ring-[#EC6824]/20",
    "data-[state=open]:border-[#EC6824] data-[state=open]:ring-2 data-[state=open]:ring-[#EC6824]/20"
  );
  const filterItemClass = "focus:bg-[#FFEDD5] focus:text-[#09090B] cursor-pointer transition-colors";

  return (
    <div className="space-y-0">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-bold text-[#09090B] tracking-tight leading-none mb-2">
            Attendance Management
          </h1>
        </div>
        <Button
          variant="outline"
          onClick={exportCSV}
          className="rounded-md border-[#E4E4E7] text-[#09090B] font-medium h-9 px-4 shadow-sm hover:bg-[#FFF4EA] hover:border-[#EC6824] transition-colors"
        >
          <Upload className="h-4 w-4 mr-2 text-[#71717A]" />
          Export CSV
        </Button>
      </div>

      {/* ── STALE OPEN SESSIONS ALERT ── */}
      {staleOpenSessions.length > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50/50 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <h3 className="text-sm font-medium text-yellow-800">Open Sessions</h3>
          </div>
          <div className="divide-y divide-black/30">
            {staleOpenSessions.map((s: any) => (
              <p key={s.id} className="text-sm text-yellow-700 py-2 first:pt-0 last:pb-0">
                <strong>{s.users?.full_name}</strong> — Open session since {formatPKTTime(s.clock_in)} on {format(new Date(s.clock_in), "MMM d")}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* ── FILTER TOOLBAR ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-[480px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
          <Input
            type="text"
            placeholder="Search by employee name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-medium border-[#E4E4E7] bg-white h-10 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] shadow-sm focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824]"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Date picker */}
        <div className="relative flex items-center">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border-[#E4E4E7] bg-white h-10 text-[13px] font-medium text-[#09090B] shadow-sm w-[150px] focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824] hover:border-[#EC6824] hover:bg-[#FFF4EA] transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full pr-8"
          />
          <Calendar className="absolute right-3 h-4 w-4 text-[#A1A1AA] pointer-events-none" />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={cn("w-[130px] rounded-md", filterTriggerClass)}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="present" className={filterItemClass}>Present</SelectItem>
            <SelectItem value="absent" className={filterItemClass}>Absent</SelectItem>
            <SelectItem value="late" className={filterItemClass}>Late</SelectItem>
          </SelectContent>
        </Select>

        {/* Work mode filter */}
        <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
          <SelectTrigger className={cn("w-[140px] rounded-md", filterTriggerClass)}>
            <SelectValue placeholder="Work Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className={filterItemClass}>All Modes</SelectItem>
            <SelectItem value="remote" className={filterItemClass}>Remote</SelectItem>
            <SelectItem value="onsite" className={filterItemClass}>Onsite</SelectItem>
          </SelectContent>
        </Select>

        {/* Late count badge */}
        {lateCount > 0 && (
          <Badge className="bg-[#FFF4EA] text-[#EC6824] border border-[#EC6824]/30 font-semibold text-[12px] px-3 py-1 rounded-md">
            {lateCount} late today
          </Badge>
        )}
      </div>

      {/* ── ATTENDANCE TABLE ── */}
      <div className="border border-[#E4E4E7] rounded-[16px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-[#71717A] text-[13px]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#71717A] text-[13px]">No records for this date</div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="px-6 py-3 border-b border-[#E4E4E7] grid gap-4 items-center text-[10px] font-bold text-[#A1A1AA] tracking-wider uppercase bg-transparent"
              style={{ gridTemplateColumns: "1.8fr 110px 110px 110px 110px 100px 80px" }}>
              <span>EMPLOYEE</span>
              <span>CLOCK IN</span>
              <span>CLOCK OUT</span>
              <span>HOURS</span>
              <span>WORK MODE</span>
              <span>STATUS</span>
              <span className="text-right">ACTIONS</span>
            </div>

            {/* Table Rows */}
            <div className="flex flex-col bg-white">
              {filtered.map((r: any) => {
                const isOversight = r.users?.is_oversight === true;
                const rowBg = isOversight ? "bg-[#FFF4EA]" : "bg-white";
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "px-6 py-4 border-b border-[#F4F4F5] last:border-b-0 grid gap-4 items-center hover:bg-[#FFF1E6] transition-colors",
                      rowBg
                    )}
                    style={{ gridTemplateColumns: "1.8fr 110px 110px 110px 110px 100px 80px" }}
                  >
                    {/* Employee */}
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-[#18181B] truncate tracking-tight">
                        {r.users?.full_name || "Unknown"}
                      </p>
                      <p className="text-[12px] text-[#71717A] truncate mt-0.5">
                        {r.users?.department || ""}
                      </p>
                    </div>

                    {/* Clock In */}
                    <div className="text-[13.5px] text-[#52525B]">
                      {r.clock_in ? formatPKTTime(r.clock_in) : <span className="text-[#A1A1AA]">—</span>}
                    </div>

                    {/* Clock Out */}
                    <div className="text-[13.5px] text-[#A1A1AA]">
                      {r.clock_out ? <span className="text-[#52525B]">{formatPKTTime(r.clock_out)}</span> : "—"}
                    </div>

                    {/* Hours */}
                    <div className="text-[13.5px] text-[#52525B] truncate">
                      {r.clock_in ? formatDuration(r.clock_in, r.clock_out) : <span className="text-[#A1A1AA]">—</span>}
                    </div>

                    {/* Work Mode */}
                    <div>
                      {r.work_mode ? (
                        <Badge
                          variant="outline"
                          className="capitalize text-[11.5px] font-medium px-3 py-0.5 rounded-md border-[#E4E4E7] text-[#52525B] bg-white"
                        >
                          {r.work_mode}
                        </Badge>
                      ) : (
                        <span className="text-[#A1A1AA] text-[13px]">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      {!r.clock_in ? (
                        <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-[#F4F4F5] text-[#71717A]">
                          Absent
                        </Badge>
                      ) : !r.clock_out ? (
                        <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-[#DCFCE7] text-[#166534]">
                          Active
                        </Badge>
                      ) : r.is_late ? (
                        <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-yellow-100 text-yellow-800">
                          Late
                        </Badge>
                      ) : (
                        <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-[#DCFCE7] text-[#166534]">
                          On Time
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end">
                      {isAdmin && (
                        <button
                          onClick={() => openEdit(r)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FFF4EA] text-[#EC6824] hover:bg-[#FFEDD5] transition-colors"
                          title="Edit attendance"
                        >
                          <Pencil className="h-[15px] w-[15px]" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Attendance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Clock In</Label>
              <Input type="time" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} className="focus-visible:ring-[#EC6824]" />
              {editClockIn && <p className="text-xs text-muted-foreground">{to12Hour(editClockIn)}</p>}
            </div>
            <div className="space-y-1">
              <Label>Clock Out</Label>
              <Input type="time" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} className="focus-visible:ring-[#EC6824]" />
              {editClockOut && <p className="text-xs text-muted-foreground">{to12Hour(editClockOut)}</p>}
            </div>
            <div className="space-y-1">
              <Label>Work Mode</Label>
              <Select value={editWorkMode} onValueChange={setEditWorkMode}>
                <SelectTrigger className="focus:ring-[#EC6824]">
                  <SelectValue placeholder="Select work mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">Onsite</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="focus-visible:ring-[#EC6824]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-[#EC6824] hover:bg-[#c4541a] text-white">
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
