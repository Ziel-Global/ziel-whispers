import React from "react";
import { formatShiftTimeLocal } from "@/hooks/useWorkSettings";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  CalendarCheck,
  Check,
  ArrowRight,
  ShieldAlert,
  Loader2,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";

export interface EmployeeDailyStripProps {
  todayAttendance: any;
  loadingAttendance: boolean;
  todayStandup: any;
  todaySubmittedHours: number;
  todayDraftCount: number;
  shiftHours: number;
  shiftStart: string;
  shiftEnd: string;
  unacknowledgedAutoClockout: any;
  hasTeammates?: boolean;
  onStandupComplete: () => void;
  isStandupPending: boolean;
  onAcknowledgeAutoClockout: (id: string) => void;
}

export function EmployeeDailyStrip({
  todayAttendance,
  loadingAttendance,
  todayStandup,
  todaySubmittedHours,
  todayDraftCount,
  shiftHours,
  shiftStart,
  shiftEnd,
  unacknowledgedAutoClockout,
  hasTeammates = true,
  onStandupComplete,
  isStandupPending,
  onAcknowledgeAutoClockout,
}: EmployeeDailyStripProps) {
  const navigate = useNavigate();

  const isClockedIn = !!todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = !!todayAttendance?.clock_out;
  const progressPct = Math.min(100, Math.round((todaySubmittedHours / shiftHours) * 100));

  return (
    <div className="space-y-3">
      {/* Auto Clock-Out Acknowledgment Warning Banner */}
      {unacknowledgedAutoClockout && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Automatic Clock-Out Notice</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Your shift was automatically closed at midnight yesterday ({unacknowledgedAutoClockout.date}).
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 hover:bg-amber-500/20 text-xs font-semibold"
            onClick={() => onAcknowledgeAutoClockout(unacknowledgedAutoClockout.id)}
          >
            Acknowledge
          </Button>
        </div>
      )}

      {/* Main Daily Strip Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Strip Item 1: Attendance Punch & Status */}
        <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  isClockedIn
                    ? "bg-emerald-500/10 text-emerald-600"
                    : isClockedOut
                    ? "bg-blue-500/10 text-blue-600"
                    : "bg-black/5 dark:bg-white/5 text-muted-foreground"
                }`}
              >
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today's Shift</p>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {formatShiftTimeLocal(shiftStart)} – {formatShiftTimeLocal(shiftEnd)} ({shiftHours}h)
                </p>
              </div>
            </div>

            {isClockedIn && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                Active Now
              </Badge>
            )}
            {isClockedOut && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                Completed
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs">
              {isClockedIn ? (
                <span>
                  Clocked in at{" "}
                  <strong>{format(new Date(todayAttendance.clock_in), "h:mm a")}</strong> (
                  {todayAttendance.work_mode})
                </span>
              ) : isClockedOut ? (
                <span>Shift ended at <strong>{format(new Date(todayAttendance.clock_out), "h:mm a")}</strong></span>
              ) : (
                <span className="text-muted-foreground">Not clocked in yet</span>
              )}
            </div>

            <Button
              size="sm"
              variant={isClockedIn ? "outline" : "default"}
              className="h-8 text-xs font-semibold px-4"
              onClick={() => navigate("/attendance/my")}
            >
              {isClockedIn ? "End Shift" : isClockedOut ? "View Summary" : "Clock In"}
            </Button>
          </div>
        </Card>

        {/* Strip Item 2: Today's Work Log Progress */}
        <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  todaySubmittedHours >= shiftHours
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-orange-500/10 text-orange-600"
                }`}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Work Logging</p>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {todaySubmittedHours}h of {shiftHours}h logged
                </p>
              </div>
            </div>

            {todayDraftCount > 0 ? (
              <Badge variant="secondary" className="text-[11px] font-medium bg-amber-100 text-amber-800">
                {todayDraftCount} Draft{todayDraftCount > 1 ? "s" : ""}
              </Badge>
            ) : todaySubmittedHours >= shiftHours ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : null}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  progressPct >= 100 ? "bg-emerald-500" : "bg-[#EB5A1E]"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="text-muted-foreground">{progressPct}% complete</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] p-0 font-medium text-[#EB5A1E] hover:text-[#EB5A1E]/80 hover:bg-transparent"
                onClick={() => navigate("/logs/submit")}
              >
                Log Work <ArrowRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Strip Item 3: Standup / Daily Check-in */}
        <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  todayStandup?.is_done
                    ? "bg-emerald-500/10 text-emerald-600"
                    : !hasTeammates
                    ? "bg-sky-500/10 text-sky-600"
                    : isClockedIn
                    ? "bg-purple-500/10 text-purple-600"
                    : "bg-slate-500/10 text-slate-500"
                }`}
              >
                {!hasTeammates ? <UserCheck className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {!hasTeammates ? "Daily Check-in" : "Daily Standup"}
                </p>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {todayStandup?.is_done
                    ? !hasTeammates ? "Alignment Confirmed" : "Standup Completed"
                    : !hasTeammates
                    ? "Self-Paced Focus"
                    : isClockedIn
                    ? "Action Needed"
                    : "Shift Pending"}
                </p>
              </div>
            </div>

            {todayStandup?.is_done ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                {!hasTeammates ? "Checked In" : "Submitted"}
              </Badge>
            ) : !hasTeammates ? (
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px]">
                Solo Contributor
              </Badge>
            ) : !isClockedIn ? (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[11px]">
                Not Clocked In
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]">
                Pending
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground line-clamp-1">
              {todayStandup?.is_done
                ? "Attendance & alignment recorded for today"
                : !hasTeammates
                ? "No team sync required. Check in to log daily focus."
                : !isClockedIn
                ? "Clock in to confirm your team standup"
                : "Confirm you participated in today's standup"}
            </span>

            {!todayStandup?.is_done ? (
              !isClockedIn ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold px-3 shrink-0"
                  onClick={() => navigate("/attendance/my")}
                >
                  Clock In First
                </Button>
              ) : (
                <Button
                  size="sm"
                  className={`h-8 text-xs font-semibold px-4 text-white shrink-0 ${
                    !hasTeammates ? "bg-sky-600 hover:bg-sky-700" : "bg-purple-600 hover:bg-purple-700"
                  }`}
                  onClick={onStandupComplete}
                  disabled={isStandupPending}
                >
                  {isStandupPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  {!hasTeammates ? "Check In" : "Mark Done"}
                </Button>
              )
            ) : (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 shrink-0">
                <Check className="h-3.5 w-3.5" /> Done
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
