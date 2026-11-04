import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NeedsAttentionItem } from "@/hooks/useExecutiveAnalyticsData";

interface ExecutiveExceptionsPanelProps {
  items: NeedsAttentionItem[];
}

export function ExecutiveExceptionsPanel({ items }: ExecutiveExceptionsPanelProps) {
  const navigate = useNavigate();

  return (
    <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
      <div>
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Needs Attention Now
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Ranked operational risks breaching SLA or capacity thresholds
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="text-xs font-semibold">
            {items.length} Flagged
          </Badge>
        </div>

        {/* Item List */}
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] mt-1">
          {items.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-90" />
              <p className="text-xs font-semibold text-foreground">All metrics healthy</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No active projects past baseline or critical blockers older than 3 days.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isDanger = item.severity === "danger";

              return (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between gap-3 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] px-1 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isDanger ? (
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 ${
                        isDanger
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                      }`}
                    >
                      {item.metric}
                    </Badge>

                    {item.linkUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(item.linkUrl!)}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Quick Links */}
      <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs">
        <span className="text-[11px] text-muted-foreground">
          Auto-evaluated every 60s
        </span>
        <Button
          variant="link"
          size="sm"
          className="text-xs font-semibold h-auto p-0 text-primary"
          onClick={() => navigate("/projects")}
        >
          View all projects &rarr;
        </Button>
      </div>
    </Card>
  );
}

