import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberPerformancePack } from "@/hooks/useTeamLeadData";
import { CheckCircle2, Clock, Calendar, CheckSquare, MessageSquare, Copy } from "lucide-react";
import { toast } from "sonner";

interface OneOnOnePrepModalProps {
  pack: MemberPerformancePack | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OneOnOnePrepModal({ pack, isOpen, onClose }: OneOnOnePrepModalProps) {
  if (!pack) return null;

  const copyDossier = () => {
    const text = `1:1 Prep Dossier: ${pack.fullName} (${pack.designation})
Past 30 Days Summary:
- Logged Hours: ${pack.totalLoggedHours}h / ${pack.expectedCapacity}h (${pack.utilizationRate}%)
- On-Time Attendance: ${pack.onTimeAttendanceRate}% (${pack.daysPresent} days present)
- Completed Deliverables: ${pack.completedTasksCount} tasks
Recent Deliverables:
${pack.recentDeliverables.map((d) => `• ${d.title} [${d.projectName}]`).join("\n")}`;

    navigator.clipboard.writeText(text);
    toast.success("1:1 talking points copied to clipboard!");
  };

  const isBalanced = pack.utilizationRate >= 70 && pack.utilizationRate <= 100;
  const isOver = pack.utilizationRate > 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarImage src={pack.avatarUrl || undefined} alt={pack.fullName} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                  {pack.fullName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-lg font-bold">{pack.fullName}</DialogTitle>
                <DialogDescription className="text-xs">
                  {pack.designation} • 30-Day 1:1 Performance Dossier
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={copyDossier}
              className="text-xs h-8 gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Summary
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 4 Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">30-Day Workload</p>
              <p className="text-xl font-bold mt-0.5 text-foreground">{pack.totalLoggedHours}h</p>
              <p className="text-[10px] text-muted-foreground">Cap: {pack.expectedCapacity}h</p>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Utilization</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-foreground">{pack.utilizationRate}%</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 py-0 ${
                    isOver ? "bg-rose-50 text-rose-700" : isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {isOver ? "High" : isBalanced ? "Optimal" : "Low"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">SSoT Target: 75-85%</p>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Punctuality</p>
              <p className="text-xl font-bold mt-0.5 text-foreground">{pack.onTimeAttendanceRate}%</p>
              <p className="text-[10px] text-muted-foreground">{pack.daysPresent} active days</p>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Delivered</p>
              <p className="text-xl font-bold mt-0.5 text-foreground">{pack.completedTasksCount}</p>
              <p className="text-[10px] text-muted-foreground">Tasks completed</p>
            </div>
          </div>

          {/* Recent Completed Deliverables */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-emerald-600" /> Recent Completed Deliverables
            </h4>
            {pack.recentDeliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-lg">
                No closed sprint tasks found in the past 30 days.
              </p>
            ) : (
              <div className="space-y-1.5">
                {pack.recentDeliverables.map((d) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-lg border border-border/50 text-xs flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-foreground truncate">{d.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                      {d.projectName}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended 1:1 Discussion Topics */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
            <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Suggested 1:1 Agenda & Coaching Topics
            </h4>
            <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
              <li>
                <strong className="text-foreground">Velocity & Pacing:</strong> Discuss workload balance ({pack.utilizationRate}% utilization rate).
              </li>
              <li>
                <strong className="text-foreground">Roadblocks:</strong> Uncover recurring blockers or estimation discrepancies.
              </li>
              <li>
                <strong className="text-foreground">Recognition:</strong> Acknowledge recent delivery across {pack.recentDeliverables.length} sprint items.
              </li>
              <li>
                <strong className="text-foreground">Skill Goals:</strong> Identify technologies or domains for next sprint growth.
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

