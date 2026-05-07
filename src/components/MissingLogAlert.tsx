import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPKTDateString } from "@/hooks/useWorkSettings";

export function MissingLogAlert() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // 1. Determine the previous working day in PKT
  // Monday -> Friday; Tue-Fri -> Yesterday; Sat/Sun -> No alert
  const today = new Date();
  const todayPKTStr = getPKTDateString(today);
  const todayPKT = new Date(todayPKTStr + "T00:00:00");
  const dayOfWeek = todayPKT.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Weekends: Suppress alert entirely
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let daysToSubtract = 1;
  if (dayOfWeek === 1) daysToSubtract = 3; // Monday -> Friday
  else if (dayOfWeek === 0) daysToSubtract = 2; // Sunday -> Friday (but we skip weekends anyway)

  const targetDate = new Date(todayPKT);
  targetDate.setDate(targetDate.getDate() - daysToSubtract);
  const targetDateStr = getPKTDateString(targetDate);

  const { data: logsData } = useQuery({
    queryKey: ["missing-log-check", user?.id, targetDateStr, profile?.created_at],
    queryFn: async () => {
      if (isWeekend) return { totalLogged: 8, expectedHours: 8 };

      // Use created_at as the strict boundary
      const createdAtDate = profile?.created_at ? profile.created_at.split("T")[0] : null;
      if (createdAtDate && targetDateStr <= createdAtDate) {
        return { totalLogged: 8, expectedHours: 8 }; // Suppress alert
      }

      // 1. Get logs for the target day
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("hours")
        .eq("user_id", user!.id)
        .eq("log_date", targetDateStr);
      
      const totalLogged = (logs || []).reduce((sum, log) => sum + Number(log.hours), 0);
      const expectedHours = 8;

      return { totalLogged, expectedHours };
    },
    enabled: !!user?.id && !!profile && profile.role !== "admin" && !isWeekend,
  });

  useEffect(() => {
    if (logsData) {
      const { totalLogged, expectedHours } = logsData;
      // Requirement: Only show if logged less than 8 hours
      if (totalLogged < expectedHours) {
        // Requirement: Track dismissal in localStorage (once per day)
        const storageKey = `missing_log_alert_dismissed_${user?.id}`;
        const lastDismissedDate = localStorage.getItem(storageKey);
        
        if (lastDismissedDate !== todayPKTStr) {
          setOpen(true);
        }
      }
    }
  }, [logsData, todayPKTStr, user?.id]);

  const handleGoToLogs = () => {
    const storageKey = `missing_log_alert_dismissed_${user?.id}`;
    localStorage.setItem(storageKey, todayPKTStr);
    setOpen(false);
    navigate("/logs/submit");
  };

  const handleClose = () => {
    const storageKey = `missing_log_alert_dismissed_${user?.id}`;
    localStorage.setItem(storageKey, todayPKTStr);
    setOpen(false);
  };

  if (!open || !logsData) return null;

  const { totalLogged, expectedHours } = logsData;
  const missingHours = Math.max(0, expectedHours - totalLogged);
  const dateLabel = dayOfWeek === 1 ? "Friday" : "yesterday";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Missing Work Log
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Our records show that your work logs for {dateLabel} (<strong>{targetDateStr}</strong>) are incomplete.
          </p>
          
          <div className="bg-red-50 p-4 rounded-lg border border-red-100 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-700 font-medium">Status</span>
              <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase">
                {totalLogged === 0 ? "Incomplete" : "Partial"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-700">Missing Hours</span>
              <span className="text-lg font-bold text-red-800">{missingHours.toFixed(1)}h</span>
            </div>
            <p className="text-xs text-red-600 mt-2">
              {totalLogged === 0 
                ? `You missed ${dateLabel}'s log entirely.`
                : `You logged ${totalLogged.toFixed(1)}h out of the expected ${expectedHours}h.`}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Please update your logs as soon as possible to ensure accurate attendance and performance tracking.
          </p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleGoToLogs} className="w-full sm:flex-1 rounded-button bg-primary hover:bg-primary/90">
            Submit Logs Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleClose} className="w-full sm:flex-1 rounded-button">
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

