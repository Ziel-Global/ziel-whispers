import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function LeaveSettingsSection() {
  const queryClient = useQueryClient();
  const [editType, setEditType] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [daysPerYear, setDaysPerYear] = useState(0);
  const [isPaid, setIsPaid] = useState(true);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("*").order("name");
      return data || [];
    },
  });

  const openAdd = () => {
    setName("");
    setDaysPerYear(0);
    setIsPaid(true);
    setAddOpen(true);
    setEditType(null);
  };

  const openEdit = (lt: any) => {
    setName(lt.name);
    setDaysPerYear(lt.days_per_year);
    setIsPaid(lt.is_paid);
    setEditType(lt);
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (editType) {
      const { error } = await supabase.from("leave_types").update({ name, days_per_year: daysPerYear, is_paid: isPaid }).eq("id", editType.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Leave type updated");
    } else {
      const { error } = await supabase.from("leave_types").insert({ name, days_per_year: daysPerYear, is_paid: isPaid });
      if (error) { toast.error(error.message); return; }
      toast.success("Leave type added");
    }
    setAddOpen(false);
    queryClient.invalidateQueries({ queryKey: ["leave-types"] });
  };

  const deleteType = async (id: string) => {
    const { error } = await supabase.from("leave_types").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Leave type deleted");
    queryClient.invalidateQueries({ queryKey: ["leave-types"] });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Leave Policy</h3>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Leave Type</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Days Per Year</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaveTypes.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No leave types configured</TableCell></TableRow>
          ) : (
            leaveTypes.map((lt: any) => (
              <TableRow key={lt.id}>
                <TableCell className="font-medium">{lt.name}</TableCell>
                <TableCell>{lt.days_per_year}</TableCell>
                <TableCell>{lt.is_paid ? "Paid" : "Unpaid"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(lt)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteType(lt.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editType ? "Edit" : "Add"} Leave Type</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual Leave" />
            </div>
            <div className="space-y-1">
              <Label>Days Per Year</Label>
              <Input type="number" value={daysPerYear} onChange={(e) => setDaysPerYear(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              <Label>Paid Leave</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editType ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
