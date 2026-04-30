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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Pencil, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { formatLateness, getPKTDateString, formatPKTTime } from "@/hooks/useWorkSettings";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];

export default function AttendanceAdminPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getPKTDateString());
  const [deptFilter, setDeptFilter] = useState("all");
  const [workModeFilter, setWorkModeFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["all-employees-for-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name").eq("status", "active").neq("role", "admin").order("full_name");
      return data || [];
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["admin-attendance", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, users!attendance_user_id_fkey(full_name, department, email)")
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
        .select("*, users!attendance_user_id_fkey(full_name, department)")
        .is("clock_out", null)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return records.filter((r: any) => {
      if (deptFilter !== "all" && r.users?.department !== deptFilter) return false;
      if (workModeFilter !== "all" && (r.work_mode || "").toLowerCase() !== workModeFilter) return false;
      if (employeeFilter !== "all" && r.user_id !== employeeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!(r.users?.full_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""));
  }, [records, deptFilter, workModeFilter, employeeFilter, searchQuery]);

  const lateCount = useMemo(() => filtered.filter((r: any) => r.is_late).length, [filtered]);

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "Active";
    const secs = Math.max(0, Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
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
    setEditNotes(rec.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const dateStr = editRecord.date;
      const clockIn = editClockIn ? `${dateStr}T${editClockIn}:00+05:00` : editRecord.clock_in;
      const clockOut = editClockOut ? `${dateStr}T${editClockOut}:00+05:00` : null;

      const { error } = await supabase.from("attendance").update({
        clock_in: clockIn,
        clock_out: clockOut,
        notes: editNotes || null,
        edited_by: user!.id,
      }).eq("id", editRecord.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "attendance.edited",
        target_entity: "attendance",
        target_id: editRecord.id,
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
      return `"${name}","${dept}","${ci}","${co}","${dur}","${r.work_mode || ""}","${r.is_late ? "Yes" : "No"}","${r.minutes_late || 0}","${r.notes || ""}"`;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Attendance Management</h1>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      {staleOpenSessions.length > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50/50">
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

      <div className="flex gap-3 items-center flex-wrap">
        <Input
          type="search"
          placeholder="Search by employee name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-[240px]"
        />
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-[180px]" />
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Employee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {allEmployees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Work Mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="onsite">Onsite</SelectItem>
          </SelectContent>
        </Select>
        {lateCount > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800">{lateCount} late today</Badge>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Work Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No records for this date</TableCell></TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.users?.full_name}</TableCell>
                  <TableCell>{r.users?.department}</TableCell>
                  <TableCell>
                    {r.clock_in ? formatPKTTime(r.clock_in) : "—"}
                    {r.is_late && (
                      <Badge className="ml-1 bg-yellow-100 text-yellow-800 text-[10px]">
                        Late by {formatLateness(r.minutes_late)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.clock_out ? formatPKTTime(r.clock_out) : "—"}
                    {r.auto_clocked_out && (
                      <Badge className="ml-1 bg-yellow-100 text-yellow-800 text-[10px]">Auto</Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.clock_in ? formatDuration(r.clock_in, r.clock_out) : "—"}</TableCell>
                  <TableCell>{r.work_mode || "—"}</TableCell>
                  <TableCell>
                    {!r.clock_out && r.clock_in ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : r.auto_clocked_out ? (
                      <Badge className="bg-yellow-100 text-yellow-800">Auto Clock-Out</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">Complete</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

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
