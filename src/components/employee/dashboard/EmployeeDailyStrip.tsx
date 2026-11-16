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
  Users,
  Building2,
  Monitor,
  Calendar,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAvatarUrl, getInitials } from "@/lib/utils";
import { format } from "date-fns";

export interface EmployeeDailyStripProps {
  todayAttendance: any;
  todayApprovedLeave?: any;
  loadingAttendance: boolean;
  todayStandup: any;
  todaySubmittedHours: number;
  todayDraftCount: number;
  shiftHours: number;
  shiftStart: string;
  shiftEnd: string;
  unacknowledgedAutoClockout: any;
  hasTeammates?: boolean;
  teamStatus?: any[];
  onStandupComplete: () => void;
  isStandupPending: boolean;
  onAcknowledgeAutoClockout: (id: string) => void;
}

export function EmployeeDailyStrip({
  todayAttendance,
  todayApprovedLeave = null,
  loadingAttendance,
  todayStandup,
  todaySubmittedHours,
  todayDraftCount,
  shiftHours,
  shiftStart,
  shiftEnd,
  unacknowledgedAutoClockout,
  hasTeammates = true,
  teamStatus = [],
  onStandupComplete,
  isStandupPending,
  onAcknowledgeAutoClockout,
}: EmployeeDailyStripProps) {
  const navigate = useNavigate();

  const isClockedIn = !!todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = !!todayAttendance?.clock_out;
  const isOnApprovedLeave = !isClockedIn && !isClockedOut && !!todayApprovedLeave;
  const progressPct = Math.min(100, Math.round((todaySubmittedHours / shiftHours) * 100));

  const activeTeamMembers = teamStatus.filter((m: any) => !!m.attendance?.clock_in && !m.attendance?.clock_out);
  const onsiteCount = activeTeamMembers.filter(
    (m: any) => m.attendance?.work_mode === "onsite" || m.attendance?.work_mode === "office"
  ).length;
  const remoteCount = activeTeamMembers.filter(
    (m: any) => m.attendance?.work_mode === "remote" || m.attendance?.work_mode === "wfh"
  ).length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            {isOnApprovedLeave && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]">
                On Leave
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
              ) : isOnApprovedLeave ? (
                <span className="text-purple-700 font-medium">
                  {(todayApprovedLeave as any)?.leave_types?.name || "Approved Leave"} today
                </span>
              ) : (
                <span className="text-muted-foreground">Not clocked in yet</span>
              )}
            </div>

            <Button
              size="sm"
              variant={isClockedIn ? "outline" : "default"}
              className="h-8 text-xs font-semibold px-4"
              disabled={isOnApprovedLeave}
              onClick={() => navigate("/attendance/my")}
            >
              {isClockedIn ? "End Shift" : isClockedOut ? "View Summary" : isOnApprovedLeave ? "On Leave" : "Clock In"}
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

        {/* Strip Item 4: Team Today (Onsite / Remote Presence) */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col justify-between gap-3 cursor-pointer hover:border-black/20 dark:hover:border-white/20 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Team Today</p>
                    <p className="text-sm font-semibold tracking-tight text-foreground">
                      {activeTeamMembers.length} active now
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px]">
                  {teamStatus.length} total
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-emerald-600" />
                    <strong className="text-foreground">{onsiteCount}</strong> On-site
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Monitor className="h-3 w-3 text-blue-600" />
                    <strong className="text-foreground">{remoteCount}</strong> Remote
                  </span>
                </div>

                <span className="text-xs font-semibold text-sky-600 flex items-center gap-1 shrink-0">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </DialogTrigger>

          <DialogContent className="p-0">
            <DialogHeader className="p-4 pb-2 border-b">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-sky-600" />
                Team Status Today
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="divide-y">
                {!teamStatus || teamStatus.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No team members found.</div>
                ) : (
                  teamStatus.map((member: any) => {
                    const clockedIn = !!member.attendance?.clock_in;
                    const mode = member.attendance?.work_mode;

                    return (
                      <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarImage src={getAvatarUrl(member.avatar_url)} />
                            <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{member.full_name}</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                              {member.designation || "Team Member"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center">
                          {member.onLeave ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Calendar className="h-3 w-3" /> On Leave ({member.onLeave})
                            </Badge>
                          ) : !clockedIn ? (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-normal border-none">
                              Not Clocked In
                            </Badge>
                          ) : member.attendance.clock_out ? (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-normal border-none">
                              Clocked Out
                            </Badge>
                          ) : mode === "onsite" || mode === "office" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Building2 className="h-3 w-3" /> On-site
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Monitor className="h-3 w-3" /> Remote
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
