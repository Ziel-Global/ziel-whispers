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
import { Download, Pencil } from "lucide-react";
import { format } from "date-fns";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Other"];

export default function AttendanceAdminPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

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

  const filtered = useMemo(() => {
    if (deptFilter === "all") return records;
    return records.filter((r: any) => r.users?.department === deptFilter);
  }, [records, deptFilter]);

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "Active";
    const secs = Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
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
      const clockIn = editClockIn ? new Date(`${dateStr}T${editClockIn}:00`).toISOString() : editRecord.clock_in;
      const clockOut = editClockOut ? new Date(`${dateStr}T${editClockOut}:00`).toISOString() : null;

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
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const header = "Employee,Department,Clock In,Clock Out,Duration,Work Mode,Notes\n";
    const rows = filtered.map((r: any) => {
      const name = r.users?.full_name || "";
      const dept = r.users?.department || "";
      const ci = r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "";
      const co = r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "";
      const dur = r.clock_in ? formatDuration(r.clock_in, r.clock_out) : "";
      return `"${name}","${dept}","${ci}","${co}","${dur}","${r.work_mode || ""}","${r.notes || ""}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Attendance Management</h1>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="flex gap-3">
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-[180px]" />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
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
                  <TableCell>{r.clock_in ? format(new Date(r.clock_in), "h:mm a") : "—"}</TableCell>
                  <TableCell>{r.clock_out ? format(new Date(r.clock_out), "h:mm a") : "—"}</TableCell>
                  <TableCell>{r.clock_in ? formatDuration(r.clock_in, r.clock_out) : "—"}</TableCell>
                  <TableCell>{r.work_mode || "—"}</TableCell>
                  <TableCell>
                    {!r.clock_out && r.clock_in ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">Complete</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
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
            </div>
            <div className="space-y-1">
              <Label>Clock Out</Label>
              <Input type="time" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} />
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
