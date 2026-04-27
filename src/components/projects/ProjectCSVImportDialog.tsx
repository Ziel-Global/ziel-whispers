import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ParsedRow = {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  errors: string[];
};

const VALID_STATUSES = ["active", "on_hold", "completed", "archived"];

function validateRow(row: Record<string, string>): ParsedRow {
  const errors: string[] = [];
  const name = row["name"]?.trim() || "";
  const description = row["description"]?.trim() || "";
  const start_date = row["start_date"]?.trim() || "";
  const end_date = row["end_date"]?.trim() || "";
  const status = row["status"]?.trim().toLowerCase() || "active";

  if (!name) errors.push("Missing name");
  if (!start_date || isNaN(Date.parse(start_date))) errors.push("Invalid start date");
  if (end_date && isNaN(Date.parse(end_date))) errors.push("Invalid end date");
  if (!VALID_STATUSES.includes(status)) errors.push("Invalid status");

  return { name, description, start_date, end_date, status, errors };
}

export function ProjectCSVImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [failedImports, setFailedImports] = useState<Array<{ name: string; reason: string }>>([]);
  const queryClient = useQueryClient();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRows([]);
      setFailedImports([]);
    }
    onOpenChange(newOpen);
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("File is empty or missing headers");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const parsed = lines.slice(1).map((line) => {
        // Handle basic CSV parsing (ignores commas inside quotes for simplicity in this basic version, but can be robust)
        // A simple split by comma since fields are usually simple strings
        const values = line.split(",").map((v) => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = values[i] || ""));
        return validateRow(obj);
      });
      setRows(parsed);
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again
    e.target.value = "";
  }, []);

  const downloadTemplate = () => {
    const csv = "name,description,start_date,end_date,status\nWebsite Redesign,Redesigning the corporate site,2024-05-01,2024-08-01,active\nMobile App API,Backend API for new mobile app,2024-06-01,,on_hold";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project_template.csv";
    a.click();
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) { toast.error("No valid rows to import"); return; }

    setImporting(true);

    let success = 0, failed = 0;
    const failedList: Array<{ name: string; reason: string }> = [];
    
    // Process in batches or one by one
    for (const row of valid) {
      try {
        const { data: project, error } = await supabase.from("projects").insert({
          name: row.name,
          description: row.description || null,
          start_date: row.start_date,
          end_date: row.end_date || null,
          status: row.status,
          created_by: profile?.id,
        }).select("id").single();
        
        if (error) {
          failed++;
          failedList.push({ name: row.name, reason: error.message || JSON.stringify(error) });
        } else {
          // Log the creation
          await supabase.from("audit_logs").insert({ 
            actor_id: profile?.id, 
            action: "project.created_via_csv", 
            target_entity: "projects", 
            target_id: project.id 
          });
          success++;
        }
      } catch (err: any) {
        failed++;
        failedList.push({ name: row.name, reason: err?.message || String(err) });
      }
    }
    
    setFailedImports(failedList);
    toast.success(`Imported ${success} projects${failed ? `, ${failed} failed` : ""}`);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    
    if (failed === 0) {
      setRows([]);
      onOpenChange(false);
    }
    setImporting(false);
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Import Projects from CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="h-4 w-4 mr-2" />Upload CSV</span>
              </Button>
            </label>
          </div>

          {rows.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{validCount} valid, {rows.length - validCount} with errors</p>
              <div className="border rounded-md max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={r.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.start_date}</TableCell>
                        <TableCell>{r.end_date || "—"}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell className="text-destructive text-xs">{r.errors.join(", ") || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {failedImports.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium">Failed Imports</h4>
              <p className="text-xs text-muted-foreground mb-2">These rows failed during server processing. You can export them to retry after fixing issues.</p>
              <div className="border rounded-md max-h-[200px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedImports.map((f, i) => (
                      <TableRow key={i} className="bg-destructive/5">
                        <TableCell>{f.name}</TableCell>
                        <TableCell className="text-destructive text-xs">{f.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const csv = "name,reason\n" + failedImports.map(f => `"${f.name}","${f.reason.replace(/"/g,'""')}"`).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `failed_project_imports_${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                }}>Export Failures</Button>
                <Button variant="outline" size="sm" onClick={() => setFailedImports([])}>Clear Failures</Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || validCount === 0}>
            {importing ? "Importing…" : `Import ${validCount} Projects`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
