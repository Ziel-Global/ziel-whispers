import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  MoreVertical,
  Bell,
  BellOff,
  Send,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { SystemAlertItem } from "@/lib/alerts/alertEngine";
import { Link } from "react-router-dom";

interface AlertItemCardProps {
  alert: SystemAlertItem;
  onSnooze: (id: string, days: number) => void;
  onUnsnooze: (id: string) => void;
  onDismiss: (id: string) => void;
  onDispatchInApp: (alert: SystemAlertItem) => void;
  onDispatchSlack: (alert: SystemAlertItem) => void;
}

export function AlertItemCard({
  alert,
  onSnooze,
  onUnsnooze,
  onDismiss,
  onDispatchInApp,
  onDispatchSlack,
}: AlertItemCardProps) {
  const isCritical = alert.severity === "critical";
  const isWarning = alert.severity === "warning";

  return (
    <Card
      className={`p-4 rounded-xl border transition-all ${
        alert.isSnoozed
          ? "opacity-60 bg-muted/30 border-muted"
          : isCritical
          ? "bg-rose-50/20 border-rose-200/80 dark:bg-rose-950/10 dark:border-rose-900/40"
          : isWarning
          ? "bg-amber-50/20 border-amber-200/80 dark:bg-amber-950/10 dark:border-amber-900/40"
          : "bg-card border-black/[0.08] dark:border-white/[0.08]"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left: Icon + Content */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              isCritical
                ? "bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300"
                : isWarning
                ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300"
                : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300"
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="h-4 w-4" />
            ) : isWarning ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            {/* Badges strip */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant={isCritical ? "destructive" : isWarning ? "outline" : "secondary"}
                className={`text-[10px] uppercase font-bold ${
                  isWarning ? "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" : ""
                }`}
              >
                {alert.severity}
              </Badge>

              <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground">
                {alert.category}
              </Badge>

              <Badge variant="secondary" className="text-[10px] font-medium text-foreground">
                {alert.entityName}
              </Badge>

              {alert.isSnoozed && (
                <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-1">
                  <BellOff className="h-2.5 w-2.5" /> Snoozed
                </Badge>
              )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-foreground tracking-tight">{alert.title}</h4>

            {/* Description */}
            <p className="text-xs text-muted-foreground">{alert.description}</p>

            {/* Suggested Action Bar */}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-foreground/80">
                Action: <span className="text-muted-foreground font-normal">{alert.suggestedAction}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Action CTA & Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
          {alert.actionHref && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1 px-2.5 font-semibold"
            >
              <Link to={alert.actionHref}>
                Resolve <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              {alert.isSnoozed ? (
                <DropdownMenuItem onClick={() => onUnsnooze(alert.id)} className="gap-2">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  Unsnooze Alert
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onSnooze(alert.id, 1)} className="gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Snooze for 1 Day
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSnooze(alert.id, 3)} className="gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Snooze for 3 Days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSnooze(alert.id, 7)} className="gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Snooze for 1 Week
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => onDispatchInApp(alert)} className="gap-2">
                <Bell className="h-3.5 w-3.5 text-blue-600" />
                Dispatch In-App
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDispatchSlack(alert)} className="gap-2">
                <Send className="h-3.5 w-3.5 text-emerald-600" />
                Send to Slack (#ops)
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDismiss(alert.id)}
                className="gap-2 text-rose-600 focus:text-rose-600"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss Alert
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

