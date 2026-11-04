import React, { useState } from "react";
import { AlertsSummaryCards } from "@/components/alerts/AlertsSummaryCards";
import { AlertItemCard } from "@/components/alerts/AlertItemCard";
import { AlertsRuleRegistryModal } from "@/components/alerts/AlertsRuleRegistryModal";
import { useAlertsEngine } from "@/hooks/useAlertsEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Search, CheckCircle2, RotateCcw } from "lucide-react";

export function ExecutiveAlertsTab() {
  const {
    alerts,
    summary,
    isLoading,
    severityFilter,
    setSeverityFilter,
    categoryFilter,
    setCategoryFilter,
    searchTerm,
    setSearchTerm,
    snoozeAlert,
    unsnoozeAlert,
    dismissAlert,
    clearAllDismissed,
    dispatchAlertToInApp,
    dispatchToSlack,
  } = useAlertsEngine();

  const [activeSubTab, setActiveSubTab] = useState<"active" | "snoozed">("active");
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const filteredFeed = alerts.filter((a) => (activeSubTab === "active" ? !a.isSnoozed : a.isSnoozed));

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            Automated Alert Triggers & Exceptions Feed
          </h3>
          <p className="text-xs text-muted-foreground">
            Continuous background evaluation of 12 workforce, project SLA, and compliance triggers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRegistryOpen(true)}
            className="text-xs h-7 gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Rule Registry (12 Rules)
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllDismissed}
            className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Dismissed
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <AlertsSummaryCards
        totalActive={summary.totalActive}
        critical={summary.critical}
        warning={summary.warning}
        snoozed={summary.snoozed}
      />

      {/* 3. Filters & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-black/[0.06] dark:border-white/[0.06]">
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)}>
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="active" className="text-xs px-3">
              Active Feed ({summary.totalActive})
            </TabsTrigger>
            <TabsTrigger value="snoozed" className="text-xs px-3">
              Snoozed ({summary.snoozed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Severities</SelectItem>
              <SelectItem value="critical" className="text-xs">Critical</SelectItem>
              <SelectItem value="warning" className="text-xs">Warning</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Categories</SelectItem>
              <SelectItem value="workforce" className="text-xs">Workforce</SelectItem>
              <SelectItem value="project" className="text-xs">Project</SelectItem>
              <SelectItem value="compliance" className="text-xs">Compliance</SelectItem>
              <SelectItem value="security" className="text-xs">Security</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Evaluating alert rules against live workforce database...
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
            <h4 className="text-xs font-bold text-foreground">
              {activeSubTab === "active" ? "All Operational Metrics Healthy" : "No Snoozed Alerts"}
            </h4>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Zero active SLA breaches or unmitigated capacity bottlenecks detected.
            </p>
          </div>
        ) : (
          filteredFeed.map((alert) => (
            <AlertItemCard
              key={alert.id}
              alert={alert}
              onSnooze={snoozeAlert}
              onUnsnooze={unsnoozeAlert}
              onDismiss={dismissAlert}
              onDispatchInApp={dispatchAlertToInApp}
              onDispatchSlack={dispatchToSlack}
            />
          ))
        )}
      </div>

      {/* 5. Registry Modal */}
      <AlertsRuleRegistryModal
        isOpen={isRegistryOpen}
        onClose={() => setIsRegistryOpen(false)}
      />
    </div>
  );
}

