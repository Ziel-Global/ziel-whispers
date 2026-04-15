import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export function AutoClockoutAlert() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch auto-clocked-out attendance records that haven't been acknowledged
  const { data: unackedAutoClockouts = [] } = useQuery({
    queryKey: ["auto-clockout-unacked", user?.id],
    queryFn: async () => {
      // Get all auto-clocked-out records for this user
      const { data: autoRecords } = await supabase
        .from("attendance")
        .select("id, date, clock_in")
        .eq("user_id", user!.id)
        .eq("auto_clocked_out", true)
        .order("date", { ascending: false });

      if (!autoRecords || autoRecords.length === 0) return [];

      // Get acknowledged ones
      const { data: acks } = await supabase
        .from("auto_clockout_acks")
        .select("attendance_id")
        .eq("user_id", user!.id);

      const ackedIds = new Set((acks || []).map(a => a.attendance_id));
      return autoRecords.filter(r => !ackedIds.has(r.id));
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const handleAcknowledge = async (attendanceId: string) => {
    await supabase.from("auto_clockout_acks").insert({
      user_id: user!.id,
      attendance_id: attendanceId,
    });
    queryClient.invalidateQueries({ queryKey: ["auto-clockout-unacked"] });
  };

  if (unackedAutoClockouts.length === 0) return null;

  const current = unackedAutoClockouts[0];

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Missed Clock-Out
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>Heads up</strong> — You forgot to clock out on{" "}
            <strong>{format(new Date(current.date + "T00:00:00"), "EEEE, MMMM d, yyyy")}</strong>, so the system
            automatically clocked you out at 12:00 AM.
          </p>
          <p className="text-sm text-muted-foreground">
            Please make it a habit to clock out at the end of your shift. Repeated occurrences may be noted in your attendance record.
          </p>
          <p className="text-sm text-muted-foreground">Thank you for your understanding.</p>
          {unackedAutoClockouts.length > 1 && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              You have {unackedAutoClockouts.length - 1} more missed clock-out{unackedAutoClockouts.length > 2 ? "s" : ""} to acknowledge.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => handleAcknowledge(current.id)} className="rounded-button w-full">
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
