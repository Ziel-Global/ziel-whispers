import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Award, CheckCircle, Clock, Calendar, Compass } from "lucide-react";
import { format } from "date-fns";

export interface PersonalAppraisalSummaryModalProps {
  profile: any;
  monthUtilizationPct: number;
  monthLoggedHours: number;
  netMonthCapacity: number;
  attendanceRate: number;
  punctualityRate: number;
  completedTasksCount: number;
  onTimeDeliveryRate: number;
  estimateAccuracy: number;
  projectsCount: number;
}

export function PersonalAppraisalSummaryModal({
  profile,
  monthUtilizationPct,
  monthLoggedHours,
  netMonthCapacity,
  attendanceRate,
  punctualityRate,
  completedTasksCount,
  onTimeDeliveryRate,
  estimateAccuracy,
  projectsCount,
}: PersonalAppraisalSummaryModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const todayStr = format(new Date(), "MMMM d, yyyy");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-semibold">
          <Award className="h-3.5 w-3.5 text-amber-500" />
          Appraisal Summary Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-black/[0.08] dark:border-white/[0.08] flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base font-bold">
              Performance & Appraisal Pack
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified monthly metrics for 1:1 check-ins and performance reviews
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 font-semibold shrink-0"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </DialogHeader>

        <div ref={printRef} className="p-6 space-y-6 text-foreground">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <h2 className="text-xl font-bold tracking-tight">{profile?.full_name}</h2>
              <p className="text-xs text-muted-foreground">
                {profile?.designation || "Team Member"} • {profile?.department || "General"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">Evaluation Date</span>
              <span className="text-xs font-semibold">{todayStr}</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl">
              <span className="text-xs text-muted-foreground block mb-1">
                Productive Hours Delivered
              </span>
              <span className="text-2xl font-bold">{monthLoggedHours}h</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Target: {netMonthCapacity}h net capacity
              </span>
            </div>

            <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl">
              <span className="text-xs text-muted-foreground block mb-1">
                Monthly Utilization Rate
              </span>
              <span className="text-2xl font-bold">{monthUtilizationPct}%</span>
              <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
                Target Band: 75% – 85%
              </span>
            </div>

            <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl">
              <span className="text-xs text-muted-foreground block mb-1">
                Attendance & Punctuality
              </span>
              <span className="text-2xl font-bold">{attendanceRate}%</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {punctualityRate}% on-time arrivals
              </span>
            </div>

            <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] rounded-xl">
              <span className="text-xs text-muted-foreground block mb-1">
                Delivery Predictability
              </span>
              <span className="text-2xl font-bold">{onTimeDeliveryRate}%</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {completedTasksCount} tasks completed
              </span>
            </div>
          </div>

          {/* Additional Performance Notes */}
          <div className="p-4 bg-muted/40 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Projects Supported:</span>
              <span className="font-semibold">{projectsCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimate Accuracy Ratio:</span>
              <span className="font-semibold">{estimateAccuracy}x (1.0 = Ideal)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Trust Baseline:</span>
              <span className="font-semibold text-emerald-600">Verified via Ziel Log Engine</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
