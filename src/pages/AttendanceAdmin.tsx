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
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Pencil, AlertTriangle, Search } from "lucide-react";
import { format } from "date-fns";
import { formatLateness, getPKTDateString, formatPKTTime, isAttendanceLate } from "@/hooks/useWorkSettings";

export default function AttendanceAdminPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getPKTDateString());
  const [statusFilter, setStatusFilter] = useState("all");
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
    const userIdsWithAttendance = new Set(records.map((r: any) => r.user_id));
    const absentRecords = activeUsers
      .filter((u: any) => !userIdsWithAttendance.has(u.id))
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
      }));

    let list: any[] = [];
    if (statusFilter === "all") {
      list = [...records, ...absentRecords];
    } else if (statusFilter === "absent") {
      list = absentRecords;
    } else if (statusFilter === "present") {
      list = records.filter((r: any) => !!r.clock_in);
    } else if (statusFilter === "late") {
      list = records.filter((r: any) => r.clock_in && r.is_late);
    } else {
      list = records;
    }

    return list
      .filter((r: any) => {
        if (workModeFilter !== "all" && (r.work_mode || "").toLowerCase() !== workModeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          if (!(r.users?.full_name || "").toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""));
  }, [records, activeUsers, statusFilter, workModeFilter, searchQuery, selectedDate]);

  const lateCount = useMemo(() => filtered.filter((r: any) => r.clock_in && r.is_late).length, [filtered]);

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    const end = clockOut ? new Date(clockOut) : new Date();
    const secs = Math.max(0, Math.floor((end.getTime() - new Date(clockIn).getTime()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m${!clockOut ? " (so far)" : ""}`;
  };

  // Format time to 12-hour for edit fields
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

      // Calculate late fields up front if clock_in changed
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

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Attendance Management</h1>
        <button
          type="button"
          onClick={exportCSV}
          className="flex items-center gap-2 bg-white border border-black/[0.08] rounded-[10px] px-4 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] transition-colors shadow-sm"
        >
          <Download className="h-3.5 w-3.5 text-[#4B4B52]" />
          Export CSV
        </button>
      </div>

      {staleOpenSessions.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-[#D97706]" />
            <h3 className="text-sm font-bold text-[#92400E]">Open Sessions</h3>
          </div>
          <div className="divide-y divide-black/10">
            {staleOpenSessions.map((s: any) => (
              <p key={s.id} className="text-xs text-[#B45309] py-2 first:pt-0 last:pb-0">
                <strong>{s.users?.full_name}</strong> — Open session since {formatPKTTime(s.clock_in)} on {format(new Date(s.clock_in), "MMM d")}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2.5 items-center flex-wrap">
        <div className="flex-1 min-w-[200px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm">
          <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Search by employee name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-[13px] text-[#17171A] placeholder:text-[#B0B0B6] focus:outline-none font-sans"
          />
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm focus:outline-none"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="late">Late</SelectItem>
          </SelectContent>
        </Select>

        <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
          <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="Work Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="onsite">Onsite</SelectItem>
          </SelectContent>
        </Select>

        {lateCount > 0 && (
          <span className="inline-block bg-[#FDF3E3] text-[#A9720B] text-[12.5px] font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap">
            {lateCount} late today
          </span>
        )}
      </div>

      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-[#8B8B92] text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#8B8B92] text-sm">No records for this date</div>
        ) : (
          <div>
            <TableHeader gridCols="1.6fr 0.8fr 0.8fr 0.9fr 0.8fr 0.8fr 0.6fr" className="px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em]">
              <span>EMPLOYEE</span>
              <span>CLOCK IN</span>
              <span>CLOCK OUT</span>
              <span>HOURS</span>
              <span>WORK MODE</span>
              <span>STATUS</span>
              <span className="text-right">ACTIONS</span>
            </TableHeader>
            {filtered.map((r: any) => {
            const isOversight = r.users?.is_oversight === true;
            return (
              <DataRow
                key={r.id}
                className={`px-5 py-3.5 border-b border-black/[0.05] transition-colors ${isOversight ? "bg-[#fef3c7] hover:bg-[#fef3c7]" : "hover:bg-[#F6F5F3]/50"}`}
                gridCols="1.6fr 0.8fr 0.8fr 0.9fr 0.8fr 0.8fr 0.6fr"
              >
                <div className="min-w-0">
                  <RowPrimary className="font-bold text-[13.5px] text-[#17171A] truncate">{r.users?.full_name || "Unknown"}</RowPrimary>
                  <RowSecondary className="text-[12px] text-[#8B8B92] truncate">{r.users?.department || ""}</RowSecondary>
                </div>
                <RowDataItem label="CLOCK IN" className="text-[13px] text-[#4B4B52]">{r.clock_in ? formatPKTTime(r.clock_in) : "—"}</RowDataItem>
                <RowDataItem label="CLOCK OUT" className="text-[13px] text-[#4B4B52]">{r.clock_out ? formatPKTTime(r.clock_out) : "—"}</RowDataItem>
                <RowDataItem label="HOURS" className="text-[13px] text-[#4B4B52] whitespace-nowrap">{r.clock_in ? formatDuration(r.clock_in, r.clock_out) : "—"}</RowDataItem>
                <RowBadgeItem label="WORK MODE">
                  <span className="inline-block border border-black/10 text-[#4B4B52] text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
                    {r.work_mode || "—"}
                  </span>
                </RowBadgeItem>
                <RowBadgeItem label="STATUS">
                  {!r.clock_in ? (
                    <Badge className="bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none">Absent</Badge>
                  ) : !r.clock_out ? (
                    <Badge className="bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none">Active</Badge>
                  ) : r.is_late ? (
                    <Badge className="bg-[#FDF3E3] text-[#A9720B] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none">Late</Badge>
                  ) : (
                    <Badge className="bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none">On Time</Badge>
                  )}
                </RowBadgeItem>
                <RowActions className="justify-self-end flex items-center justify-end">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="w-7 h-7 rounded-[8px] bg-[#FDECE3] hover:bg-[#FCD8C5] text-[#EB5A1E] flex items-center justify-center transition-colors"
                      title="Edit Attendance"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#EB5A1E]" />
                    </button>
                  )}
                </RowActions>
              </DataRow>
            );
          })}
          </div>
        )}
      </div>

      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Attendance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Clock In</Label>
              <Input type="time" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} />
              {editClockIn && <p className="text-xs text-muted-foreground">{to12Hour(editClockIn)}</p>}
            </div>
            <div className="space-y-1">
              <Label>Clock Out</Label>
              <Input type="time" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} />
              {editClockOut && <p className="text-xs text-muted-foreground">{to12Hour(editClockOut)}</p>}
            </div>
            <div className="space-y-1">
              <Label>Work Mode</Label>
              <Select value={editWorkMode} onValueChange={setEditWorkMode}>
                <SelectTrigger>
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
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
