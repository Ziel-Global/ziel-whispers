import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";

type ParsedRow = {
  full_name: string;
  email: string;
  phone?: string;
  designation: string;
  department: string;
  employment_type: string;
  join_date: string;
  role?: string;
  errors: string[];
};

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];
const EMP_TYPES = ["full-time", "part-time", "contract"];

function validateRow(row: Record<string, string>): ParsedRow {
  const errors: string[] = [];
  const full_name = row["full_name"]?.trim() || "";
  const email = row["email"]?.trim() || "";
  const designation = row["designation"]?.trim() || "";
  const department = row["department"]?.trim() || "";
  const employment_type = row["employment_type"]?.trim() || "";
  const join_date = row["join_date"]?.trim() || "";
  const role = row["role"]?.trim() || "employee";
  const phone = row["phone"]?.trim() || "";

  if (!full_name) errors.push("Missing name");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email");
  if (!designation) errors.push("Missing designation");
  if (!DEPARTMENTS.includes(department)) errors.push("Invalid department");
  if (!EMP_TYPES.includes(employment_type)) errors.push("Invalid type");
  if (!join_date || isNaN(Date.parse(join_date))) errors.push("Invalid date");

  return { full_name, email, phone, designation, department, employment_type, join_date, role, errors };
}

export function CSVImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState<string>("User@12345");
  const [failedImports, setFailedImports] = useState<Array<{ full_name: string; email: string; reason: string }>>([]);
  const queryClient = useQueryClient();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setRows([]);
      setFailedImports([]);
      setDefaultPassword("User@12345");
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
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const parsed = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = values[i] || ""));
        return validateRow(obj);
      });
      setRows(parsed);
    };
    reader.readAsText(file);
  }, []);

  const downloadTemplate = () => {
    const csv = "full_name,email,phone,designation,department,employment_type,join_date,role\nJohn Doe,john@example.com,+1234567890,Developer,Engineering,full-time,2024-01-15,employee";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_template.csv";
    a.click();
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) { toast.error("No valid rows to import"); return; }
    // Validate default password if provided
    if (defaultPassword && defaultPassword.length > 0 && defaultPassword.length < 8) {
      toast.error("Default password must be at least 8 characters");
      return;
    }

    const useDefault = defaultPassword && defaultPassword.length >= 8;

    setImporting(true);

    let success = 0, failed = 0;
    const failedList: Array<{ full_name: string; email: string; reason: string }> = [];
    for (const row of valid) {
      const passwordToUse = useDefault ? defaultPassword : crypto.randomUUID().slice(0, 12) + "A1!";
      try {
        const res = await supabase.functions.invoke("invite-user", { body: { ...row, password: passwordToUse } });
        const { data, error } = res as any;
        if (error) {
          failed++;
          failedList.push({ full_name: row.full_name, email: row.email, reason: error.message || JSON.stringify(error) });
        } else if (data && data.ok === false) {
          failed++;
          const reason = data.error || JSON.stringify(data);
          failedList.push({ full_name: row.full_name, email: row.email, reason });
        } else {
          success++;
        }
      } catch (err: any) {
        failed++;
        failedList.push({ full_name: row.full_name, email: row.email, reason: err?.message || String(err) });
      }
    }
    setFailedImports(failedList);
    toast.success(`Imported ${success} employees${failed ? `, ${failed} failed` : ""}`);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    // If no failures, clear and close. Otherwise keep the dialog open so admin can review failures.
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
          <DialogTitle>Import Employees from CSV</DialogTitle>
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
          <div className="flex items-center gap-3 mt-2">
            <div className="w-[320px]">
              <Label className="text-xs">Default password for imported users</Label>
              <Input value={defaultPassword} onChange={(e) => setDefaultPassword((e.target as HTMLInputElement).value)} placeholder="User@12345" />
              <p className="text-xs text-muted-foreground mt-1">If set, this password will be applied to every imported user. Users will be required to change it on first login.</p>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{validCount} valid, {rows.length - validCount} with errors</p>
              <div className="border rounded-md max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={r.errors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell>{r.full_name}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{r.department}</TableCell>
                        <TableCell>{r.employment_type}</TableCell>
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
                  <TableHead>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {failedImports.map((f, i) => (
                      <TableRow key={i} className="bg-destructive/5">
                        <TableCell>{f.full_name}</TableCell>
                        <TableCell>{f.email}</TableCell>
                        <TableCell className="text-destructive text-xs">{f.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const csv = "full_name,email,reason\n" + failedImports.map(f => `"${f.full_name}","${f.email}","${f.reason.replace(/"/g,'""')}"`).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `failed_imports_${new Date().toISOString().slice(0,10)}.csv`;
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
            {importing ? "Importing…" : `Import ${validCount} Employees`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
