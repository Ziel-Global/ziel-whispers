import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, Clock, RefreshCcw, Target, CheckCircle2 } from "lucide-react";

interface LeadCycleAndQualityCardsProps {
  metrics: {
    medianCycleHours: number;
    medianLeadHours: number;
    onTimeDeliveryRate: number;
    reworkRate: number;
    goalsProgressPct: number;
    totalGoals: number;
    completedGoals: number;
  };
}

export function LeadCycleAndQualityCards({ metrics }: LeadCycleAndQualityCardsProps) {
  const formatHours = (hrs: number) => {
    if (hrs < 24) return `${hrs}h`;
    const days = Math.round((hrs / 24) * 10) / 10;
    return `${days}d`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Cycle Time */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Median Cycle Time</span>
          <div className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40">
            <Timer className="h-4 w-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {formatHours(metrics.medianCycleHours)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Start to completion (in-progress duration)
          </p>
        </div>
        <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
          <span>Target: &lt; 3 days</span>
          <Badge variant="outline" className="text-[9.5px] bg-emerald-50 text-emerald-700 border-emerald-200">
            Healthy
          </Badge>
        </div>
      </Card>

      {/* 2. Lead Time */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Median Lead Time</span>
          <div className="p-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/40">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {formatHours(metrics.medianLeadHours)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Creation to completion total duration
          </p>
        </div>
        <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
          <span>Target: &lt; 7 days</span>
          <Badge variant="outline" className="text-[9.5px] bg-emerald-50 text-emerald-700 border-emerald-200">
            On Track
          </Badge>
        </div>
      </Card>

      {/* 3. Rework & Reopen Rate */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Rework & Reopen Rate</span>
          <div className="p-1 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40">
            <RefreshCcw className="h-4 w-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.reworkRate}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tasks sent back from QA or Code Review
          </p>
        </div>
        <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
          <span>Target: &lt; 10%</span>
          <Badge
            variant="outline"
            className={`text-[9.5px] ${
              metrics.reworkRate <= 10
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {metrics.reworkRate <= 10 ? "Passing" : "Attention"}
          </Badge>
        </div>
      </Card>

      {/* 4. Strategic Goals / OKRs */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Goals / OKR Progress</span>
          <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <Target className="h-4 w-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.goalsProgressPct}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metrics.completedGoals} of {metrics.totalGoals} project goals achieved
          </p>
        </div>
        <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
          <span>Target: &gt; 80%</span>
          <Badge variant="outline" className="text-[9.5px] bg-emerald-50 text-emerald-700 border-emerald-200">
            Aligned
          </Badge>
        </div>
      </Card>
    </div>
  );
}

