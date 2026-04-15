import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Save, Trash2 } from "lucide-react";

type Props = { employeeId: string };

export function LeaveBalancesTab({ employeeId }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [addTypeId, setAddTypeId] = useState("");
  const [addDays, setAddDays] = useState(0);

  const { data: balances = [] } = useQuery({
    queryKey: ["employee-leave-balances", employeeId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name)")
        .eq("user_id", employeeId)
        .eq("year", year);
      return data || [];
    },
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("*").order("name");
      return data || [];
    },
  });

  const { data: employee } = useQuery({
    queryKey: ["employee-name", employeeId],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("full_name").eq("id", employeeId).single();
      return data;
    },
  });

  const existingTypeIds = balances.map((b: any) => b.leave_type_id);
  const availableTypes = leaveTypes.filter((lt: any) => !existingTypeIds.includes(lt.id));

  const updateDays = async (balanceId: string, totalDays: number) => {
    const { error } = await supabase.from("leave_balances").update({ total_days: totalDays }).eq("id", balanceId);
    if (error) { toast.error(error.message); return; }
    toast.success("Balance updated");
    queryClient.invalidateQueries({ queryKey: ["employee-leave-balances"] });
  };

  const deleteBalance = async (balance: any) => {
    const { error } = await supabase.from("leave_balances").delete().eq("id", balance.id);
    if (error) { toast.error(error.message); return; }

    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action: "leave_balance.deleted",
      target_entity: "leave_balances",
      target_id: balance.id,
      metadata: {
        employee_name: employee?.full_name || "Unknown",
        leave_type: balance.leave_types?.name || "Unknown",
      },
    });

    toast.success("Leave balance deleted");
    queryClient.invalidateQueries({ queryKey: ["employee-leave-balances"] });
  };

  const addBalance = async () => {
    if (!addTypeId) return;
    const { error } = await supabase.from("leave_balances").insert({
      user_id: employeeId,
      leave_type_id: addTypeId,
      year,
      total_days: addDays || 0,
      used_days: 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Leave balance added");
    setAddTypeId("");
    setAddDays(0);
    queryClient.invalidateQueries({ queryKey: ["employee-leave-balances"] });
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-semibold">Leave Balances — {year}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Leave Type</TableHead>
            <TableHead>Total Days</TableHead>
            <TableHead>Used</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {balances.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No balances configured</TableCell></TableRow>
          ) : (
            balances.map((b: any) => (
              <EditableBalanceRow key={b.id} balance={b} onSave={updateDays} onDelete={deleteBalance} />
            ))
          )}
        </TableBody>
      </Table>

      {availableTypes.length > 0 && (
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Add Leave Type</Label>
            <Select value={addTypeId} onValueChange={setAddTypeId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {availableTypes.map((lt: any) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Days</Label>
            <Input type="number" value={addDays} onChange={(e) => setAddDays(Number(e.target.value))} className="w-[80px]" />
          </div>
          <Button size="sm" onClick={addBalance}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
      )}
    </Card>
  );
}

function EditableBalanceRow({ balance, onSave, onDelete }: { balance: any; onSave: (id: string, days: number) => void; onDelete: (balance: any) => void }) {
  const [days, setDays] = useState(balance.total_days);
  const changed = days !== balance.total_days;

  return (
    <TableRow>
      <TableCell className="font-medium">{balance.leave_types?.name}</TableCell>
      <TableCell>
        <Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-[80px]" />
      </TableCell>
      <TableCell>{balance.used_days}</TableCell>
      <TableCell>{days - balance.used_days}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {changed && <Button size="sm" variant="ghost" onClick={() => onSave(balance.id, days)}><Save className="h-4 w-4" /></Button>}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Leave Balance?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this leave balance? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(balance)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
