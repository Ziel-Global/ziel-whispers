import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Clock, Briefcase, FileText, Bell, CheckCircle2, AlertCircle } from "lucide-react";
import { TeamMemberLiveStatus } from "@/hooks/useTeamLeadData";
import { format } from "date-fns";

interface TodayTeamBoardProps {
  members: TeamMemberLiveStatus[];
  onOpenOneOnOne: (memberId: string) => void;
  onNudge: (userId: string, name: string) => void;
}

export function TodayTeamBoard({ members, onOpenOneOnOne, onNudge }: TodayTeamBoardProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            Today's Team Live Board
          </h3>
          <p className="text-xs text-muted-foreground">
            Real-time presence, in-flight sprint tasks, and today's logged hours
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-semibold">
          {members.filter((m) => m.isClockedIn).length} / {members.length} Present Now
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {members.map((m) => {
          const hoursLogged = m.loggedTodayHours;
          const targetHours = 8;
          const progressPct = Math.min(100, Math.round((hoursLogged / targetHours) * 100));

          return (
            <Card
              key={m.id}
              className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all"
            >
              <div>
                {/* Header: User Info & Live Attendance Badge */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-black/[0.05] dark:border-white/[0.05]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      <Avatar className="h-9 w-9 text-xs">
                        <AvatarImage src={m.avatarUrl || undefined} alt={m.fullName} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {m.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                          m.isClockedIn ? "bg-emerald-500" : "bg-muted-foreground/30"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{m.fullName}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">{m.designation}</p>
                    </div>
                  </div>

                  {m.isClockedIn ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-semibold shrink-0"
                    >
                      {m.workMode === "remote" ? "Remote" : "Onsite"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] shrink-0 text-muted-foreground">
                      Offline
                    </Badge>
                  )}
                </div>

                {/* Live Status Details */}
                <div className="py-2.5 space-y-2 text-xs">
                  {/* Clock-in info */}
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Clocked In:
                    </span>
                    <span className="font-medium text-foreground">
                      {m.clockInTime ? (
                        <>
                          {m.clockInTime.length > 5 ? m.clockInTime.substring(11, 16) : m.clockInTime}
                          {m.minutesLate > 0 && (
                            <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                              ({m.minutesLate}m late)
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>

                  {/* Today's Logged Hours Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Logged Today:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {hoursLogged}h <span className="text-muted-foreground font-normal">/ {targetHours}h</span>
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-1.5" />
                  </div>

                  {/* Current In-flight Task */}
                  <div className="p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                    <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="h-2.5 w-2.5" /> Active Task
                      </span>
                      {m.activeTask?.priority && (
                        <span
                          className={`font-semibold uppercase ${
                            m.activeTask.priority === "high"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {m.activeTask.priority}
                        </span>
                      )}
                    </div>
                    {m.activeTask ? (
                      <div>
                        <p className="text-[11px] font-medium text-foreground line-clamp-1">
                          {m.activeTask.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {m.activeTask.projectName}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">
                        No in-progress sprint task
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenOneOnOne(m.id)}
                  className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground gap-1"
                >
                  <FileText className="h-3 w-3" />
                  1:1 Pack
                </Button>

                {!m.hasLoggedYesterday && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNudge(m.id, m.fullName)}
                    className="h-7 text-[11px] px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1"
                  >
                    <Bell className="h-3 w-3" />
                    Nudge Log
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

