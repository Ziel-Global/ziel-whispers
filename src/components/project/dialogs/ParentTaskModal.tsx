import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Download, Eye, EyeOff, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseCSVLine, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export type SubtaskCsvRow = {
  rowNum: number;
  title: string;
  description: string;
  priority: string;
  estimated_hours: string;
  due_date: string;
  client_visible: string;
  assigned_to: string;
  resolvedId: string | null;
  errors: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  profileId?: string;
  allEmployees: any[];
  initialStatusId?: string | null;
  /** When set, only uploads subtasks under this parent (no parent form). */
  existingParentId?: string | null;
  existingParentTitle?: string | null;
  defaultClientVisible?: boolean;
  onSuccess: () => void;
};

const CSV_SAMPLE =
  "title,description,priority,estimated_hours,due_date,client_visible,assigned_to\nDesign login page,Create mockups for the login screen,high,8,2025-09-01,true,\nAPI integration,Integrate REST API endpoints,medium,,2025-09-15,false,John Doe\nBug fix,Fix sidebar rendering issue,low,2,2025-08-20,true,";

function parseDateFlexible(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const native = Date.parse(trimmed);
  if (!isNaN(native)) return new Date(native).toISOString().split("T")[0];
  return null;
}

export function sumSubtaskEstimatedHours(rows: SubtaskCsvRow[]): number {
  return rows
    .filter((r) => r.errors.length === 0)
    .reduce((sum, r) => sum + (r.estimated_hours ? Number(r.estimated_hours) || 0 : 0), 0);
}

export function parseSubtaskCsvText(
  text: string,
  allEmployees: any[]
): { rows: SubtaskCsvRow[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], error: "CSV must have a header row and at least one data row" };
  }
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const titleIdx = headers.indexOf("title");
  const descIdx = headers.indexOf("description");
  const prioIdx = headers.indexOf("priority");
  const estIdx = headers.indexOf("estimated_hours");
  const dueDateIdx = headers.indexOf("due_date");
  const clientVisIdx = headers.indexOf("client_visible");
  const assignedToIdx = headers.indexOf("assigned_to");

  if (titleIdx === -1) {
    return { rows: [], error: "CSV must have a 'title' column" };
  }

  const employeeNameToId: Record<string, string> = {};
  (allEmployees || []).forEach((e: any) => {
    const fullName = (e.full_name || "").trim().toLowerCase();
    if (fullName) employeeNameToId[fullName] = e.user_id || e.id;
  });

  const rows: SubtaskCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const title = cols[titleIdx]?.trim() || "";
    const description = descIdx !== -1 ? cols[descIdx]?.trim() || "" : "";
    let priority = prioIdx !== -1 ? cols[prioIdx]?.trim().toLowerCase() || "" : "";
    const estimated_hours = estIdx !== -1 ? cols[estIdx]?.trim() || "" : "";
    const due_date = dueDateIdx !== -1 ? cols[dueDateIdx]?.trim() || "" : "";
    const client_visible = clientVisIdx !== -1 ? cols[clientVisIdx]?.trim().toLowerCase() || "" : "";
    const assigned_to = assignedToIdx !== -1 ? cols[assignedToIdx]?.trim() || "" : "";
    const errors: string[] = [];

    if (!title) errors.push("Title is required");
    if (!priority) priority = "medium";
    if (!["high", "medium", "low"].includes(priority)) {
      errors.push("Priority must be high, medium, or low");
      priority = "medium";
    }
    if (estimated_hours && isNaN(Number(estimated_hours))) errors.push("Invalid estimated_hours");

    const parsedDueDate = parseDateFlexible(due_date);
    const resolvedId = assigned_to ? employeeNameToId[assigned_to.trim().toLowerCase()] || null : null;
    if (assigned_to && !resolvedId) errors.push(`Employee "${assigned_to}" not found`);

    rows.push({
      rowNum: i,
      title,
      description,
      priority,
      estimated_hours,
      due_date: parsedDueDate || due_date,
      client_visible,
      assigned_to,
      resolvedId,
      errors,
    });
  }
  return { rows };
}

async function recomputeParentEstimatedHours(parentId: string) {
  const { data: children, error } = await supabase
    .from("tasks")
    .select("estimated_hours")
    .eq("parent_id", parentId);
  if (error) throw error;
  const sum = (children || []).reduce(
    (acc: number, c: any) => acc + (Number(c.estimated_hours) || 0),
    0
  );
  const { error: updErr } = await supabase
    .from("tasks")
    .update({ estimated_hours: sum > 0 ? sum : null })
    .eq("id", parentId);
  if (updErr) throw updErr;
}

export function ParentTaskModal({
  open,
  onOpenChange,
  projectId,
  profileId,
  allEmployees,
  initialStatusId,
  existingParentId,
  existingParentTitle,
  defaultClientVisible = true,
  onSuccess,
}: Props) {
  const addOnly = !!existingParentId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [clientVisible, setClientVisible] = useState(true);
  const [requireSubtasksDone, setRequireSubtasksDone] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<SubtaskCsvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const csvEstimateSum = useMemo(() => sumSubtaskEstimatedHours(csvRows), [csvRows]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setClientVisible(true);
    setRequireSubtasksDone(false);
    setCsvFileName("");
    setCsvRows([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { rows, error } = parseSubtaskCsvText(text, allEmployees);
      if (error) {
        toast.error(error);
        setCsvRows([]);
        return;
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resolveClientVisible = (raw: string, fallback: boolean) => {
    if (!raw) return fallback;
    return !["false", "no", "0"].includes(raw);
  };

  const handleSubmit = async () => {
    if (!projectId) return;
    if (!addOnly && !title.trim()) {
      toast.error("Parent title is required");
      return;
    }
    const validRows = csvRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("Upload a CSV with at least one valid subtask row");
      return;
    }

    setSubmitting(true);
    try {
      let parentId = existingParentId || null;
      let parentClientVisible = defaultClientVisible;
      const csvSum = sumSubtaskEstimatedHours(validRows);

      if (!addOnly) {
        const { data: parent, error: parentError } = await supabase
          .from("tasks")
          .insert({
            project_id: projectId,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            estimated_hours: csvSum > 0 ? csvSum : null,
            due_date: dueDate || null,
            client_visible: clientVisible,
            assigned_to: null,
            sprint_id: null,
            status_id: initialStatusId || null,
            created_by: profileId || null,
            parent_id: null,
            require_subtasks_done: requireSubtasksDone,
          })
          .select("id, client_visible")
          .single();
        if (parentError) throw parentError;
        parentId = parent.id;
        parentClientVisible = parent.client_visible !== false;
      }

      const inserts = validRows.map((r) => ({
        project_id: projectId,
        parent_id: parentId!,
        title: r.title,
        description: r.description || null,
        priority: r.priority,
        estimated_hours: r.estimated_hours ? parseFloat(r.estimated_hours) : null,
        due_date: r.due_date || null,
        client_visible: resolveClientVisible(r.client_visible, parentClientVisible),
        assigned_to: r.resolvedId || null,
        sprint_id: null,
        status_id: initialStatusId || null,
        created_by: profileId || null,
        require_subtasks_done: false,
      }));

      const { error: subError } = await supabase.from("tasks").insert(inserts);
      if (subError) throw subError;

      // Always recompute from all children (covers add-more + keeps create consistent)
      await recomputeParentEstimatedHours(parentId!);

      toast.success(
        addOnly
          ? `${inserts.length} subtask(s) added`
          : `Parent created with ${inserts.length} subtask(s)`
      );
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_SAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtask-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {addOnly ? `Add subtasks to “${existingParentTitle || "Parent"}”` : "Add Parent Task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!addOnly && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Parent title *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Parent task title" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority *</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due date</label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                      {dueDate ? format(new Date(dueDate + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        setDueDate(d ? format(d, "yyyy-MM-dd") : "");
                        setDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="parent-client-visible" checked={clientVisible} onCheckedChange={(v) => setClientVisible(v === true)} />
                <label htmlFor="parent-client-visible" className="text-sm font-medium cursor-pointer">Visible to client</label>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Require all subtasks done before closing parent</p>
                  <p className="text-xs text-muted-foreground">When on, the parent cannot move to Done while subtasks are open.</p>
                </div>
                <Switch checked={requireSubtasksDone} onCheckedChange={setRequireSubtasksDone} />
              </div>
            </>
          )}

          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Subtasks CSV</p>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />Template
              </Button>
            </div>
            <div className="bg-muted rounded p-2 text-xs font-mono">title,description,priority,estimated_hours,due_date,client_visible,assigned_to</div>
            <p className="text-xs text-muted-foreground">
              Same format as Bulk Add. Assignees come from CSV. Sprint is assigned later from the Sprint section. Blank client_visible inherits the parent.
            </p>
            <Input type="file" accept=".csv" onChange={handleCSVUpload} className="h-9" />
            {csvFileName && <p className="text-xs text-muted-foreground">File: {csvFileName}</p>}
            {csvRows.some((r) => r.errors.length === 0) && (
              <p className="text-sm font-medium">
                Estimated hours (from subtasks): {csvEstimateSum}
              </p>
            )}
          </Card>

          {csvRows.length > 0 && (
            <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Row</th>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Est. hrs</th>
                    <th className="text-left p-2">Priority</th>
                    <th className="text-left p-2">Visible</th>
                    <th className="text-left p-2">Assignee</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((r) => (
                    <tr key={r.rowNum} className="border-t">
                      <td className="p-2">{r.rowNum}</td>
                      <td className="p-2">{r.title || "—"}</td>
                      <td className="p-2">{r.estimated_hours || "—"}</td>
                      <td className="p-2">{r.priority}</td>
                      <td className="p-2">
                        {resolveClientVisible(r.client_visible, true) ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-2">{r.assigned_to || "—"}</td>
                      <td className="p-2">
                        {r.errors.length === 0 ? (
                          <span className="text-green-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />OK</span>
                        ) : (
                          <span className="text-red-500 inline-flex items-center gap-1" title={r.errors.join("; ")}>
                            <XCircle className="h-3 w-3" />{r.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Saving…" : addOnly ? "Add subtasks" : "Create parent + subtasks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
