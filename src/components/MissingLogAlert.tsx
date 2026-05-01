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

  // Get yesterday's date in PKT
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getPKTDateString(yesterday);

  const { data: logsData } = useQuery({
    queryKey: ["missing-log-check", user?.id, yesterdayStr, profile?.join_date],
    queryFn: async () => {
      // FIX: Check if employee had even joined by yesterday
      const joinDate = profile?.join_date;
      if (joinDate && yesterdayStr < joinDate) {
        return { totalLogged: 8, expectedHours: 8 }; // Fake a full log to suppress alert
      }

      // 1. Get logs for yesterday
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("hours")
        .eq("user_id", user!.id)
        .eq("log_date", yesterdayStr);
      
      const totalLogged = (logs || []).reduce((sum, log) => sum + Number(log.hours), 0);

      // 2. Target work hours is 8 (Total shift is 9, but 1 hour is break)
      const expectedHours = 8;

      return { totalLogged, expectedHours };
    },
    enabled: !!user?.id && !!profile && profile.role !== "admin", // Explicitly exclude admins and wait for profile
  });

  useEffect(() => {
    if (logsData) {
      const { totalLogged, expectedHours } = logsData;
      if (totalLogged < expectedHours) {
        // Check if already shown this session
        const sessionKey = `missing_log_alert_${yesterdayStr}`;
        const alreadyShown = sessionStorage.getItem(sessionKey);
        if (!alreadyShown) {
          setOpen(true);
        }
      }
    }
  }, [logsData, yesterdayStr]);

  const handleGoToLogs = () => {
    sessionStorage.setItem(`missing_log_alert_${yesterdayStr}`, "true");
    setOpen(false);
    navigate("/logs/submit");
  };

  const handleClose = () => {
    sessionStorage.setItem(`missing_log_alert_${yesterdayStr}`, "true");
    setOpen(false);
  };

  if (!open || !logsData) return null;

  const { totalLogged, expectedHours } = logsData;
  const missingHours = Math.max(0, expectedHours - totalLogged);

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
            Our records show that your work logs for yesterday (<strong>{yesterdayStr}</strong>) are incomplete.
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
                ? `You missed yesterday's log entirely.`
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
