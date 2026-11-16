import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function AutoClockoutAlert() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch admin-configured display label for auto clock-out time
  const { data: autoClockoutLabel } = useQuery({
    queryKey: ["auto-clockout-display-label"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "auto_clockout_display_time")
        .maybeSingle();
      return (data?.value as string) || "12:00 AM";
    },
  });

  const { data: unackedAutoClockouts = [] } = useQuery({
    queryKey: ["auto-clockout-unacked", user?.id],
    queryFn: async () => {
      const { data: autoRecords } = await supabase
        .from("attendance")
        .select("id, date, clock_in")
        .eq("user_id", user!.id)
        .eq("auto_clocked_out", true)
        .order("date", { ascending: false });

      if (!autoRecords || autoRecords.length === 0) return [];

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

  const unackedKey = ["auto-clockout-unacked", user?.id];

  // Optimistic: close instantly, persist in background, roll back on failure.
  const handleAcknowledge = (attendanceId: string) => {
    const previous = queryClient.getQueryData<{ id: string }[]>(unackedKey);
    queryClient.setQueryData<{ id: string }[]>(unackedKey, (old = []) =>
      old.filter((r) => r.id !== attendanceId)
    );

    supabase
      .from("auto_clockout_acks")
      .upsert(
        {
          user_id: user!.id,
          attendance_id: attendanceId,
          tenant_id: profile?.tenant_id,
        } as any,
        { onConflict: "user_id,attendance_id", ignoreDuplicates: true }
      )
      .then(({ error }) => {
        if (error) {
          console.error("Failed to acknowledge auto clock-out:", error);
          queryClient.setQueryData(unackedKey, previous);
          toast.error("Couldn't save your acknowledgement. Please try again.");
        }
      });
  };

  if (unackedAutoClockouts.length === 0) return null;

  const current = unackedAutoClockouts[0];
  const displayTime = autoClockoutLabel || "12:00 AM";

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleAcknowledge(current.id); }}>
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
            automatically clocked you out at {displayTime}.
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
