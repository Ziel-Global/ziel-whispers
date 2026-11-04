import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { TeamMemberLiveStatus } from "@/hooks/useTeamLeadData";

interface YesterdayLoggingStripProps {
  yesterdayStr: string;
  totalCount: number;
  submittedCount: number;
  missingCount: number;
  members: TeamMemberLiveStatus[];
  onNudgeAll: () => void;
  onNudgeOne: (userId: string, name: string) => void;
}

export function YesterdayLoggingStrip({
  yesterdayStr,
  totalCount,
  submittedCount,
  missingCount,
  members,
  onNudgeAll,
  onNudgeOne,
}: YesterdayLoggingStripProps) {
  const complianceRate = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 100;
  const isAllGood = missingCount === 0;

  const missingMembers = members.filter((m) => !m.hasLoggedYesterday);

  return (
    <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Summary & Compliance */}
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl flex items-center justify-center ${
              isAllGood
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isAllGood ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Yesterday's Log Submissions ({yesterdayStr})
              </h3>
              <Badge
                variant="outline"
                className={`text-[11px] font-bold ${
                  complianceRate >= 90
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                }`}
              >
                {complianceRate}% Compliant
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {submittedCount} of {totalCount} members submitted their daily work log on time
            </p>
          </div>
        </div>

        {/* Right: Missing Members & Nudge Action */}
        <div className="flex items-center gap-3 flex-wrap">
          {missingMembers.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Missing ({missingMembers.length}):
              </span>
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {missingMembers.slice(0, 4).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={`Click to nudge ${m.fullName}`}
                    onClick={() => onNudgeOne(m.id, m.fullName)}
                    className="hover:scale-110 transition-transform focus:outline-none"
                  >
                    <Avatar className="h-6 w-6 border-2 border-background text-[10px]">
                      <AvatarImage src={m.avatarUrl || undefined} alt={m.fullName} />
                      <AvatarFallback className="bg-rose-100 text-rose-700 font-bold">
                        {m.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ))}
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={onNudgeAll}
                className="text-xs h-8 gap-1.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Bell className="h-3.5 w-3.5" />
                Nudge All ({missingMembers.length})
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              100% On-Time Log Submissions
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

