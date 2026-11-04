import React, { useState } from "react";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { AlertsSummaryCards } from "@/components/alerts/AlertsSummaryCards";
import { AlertItemCard } from "@/components/alerts/AlertItemCard";
import { AlertsRuleRegistryModal } from "@/components/alerts/AlertsRuleRegistryModal";
import { useAlertsEngine } from "@/hooks/useAlertsEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Search, SlidersHorizontal, RefreshCw, CheckCircle2, RotateCcw } from "lucide-react";

export default function AlertsCenterPage() {
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

  const [activeTab, setActiveTab] = useState<"active" | "snoozed">("active");
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", href: "/analytics" },
    { label: "Alerts & Notifications Engine", level: "company" },
  ];

  // Separate active vs snoozed
  const filteredFeed = alerts.filter((a) => (activeTab === "active" ? !a.isSnoozed : a.isSnoozed));

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Automated Alerts & Notification Engine
          </h1>
          <p className="text-xs text-muted-foreground">
            Continuous background evaluation of 12 workforce, project SLA, and compliance triggers
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRegistryOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Rule Registry (12 Rules)
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllDismissed}
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Dismissed
          </Button>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <AlertsSummaryCards
        totalActive={summary.totalActive}
        critical={summary.critical}
        warning={summary.warning}
        snoozed={summary.snoozed}
      />

      {/* 3. Filter Bar & Feed Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="h-8 text-xs">
              <TabsTrigger value="active" className="text-xs px-3">
                Active Feed ({summary.totalActive})
              </TabsTrigger>
              <TabsTrigger value="snoozed" className="text-xs px-3">
                Snoozed ({summary.snoozed})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
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

          {/* Severity filter */}
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

          {/* Category filter */}
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

      {/* 4. Alert Items Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Evaluating alert rules against live workforce database...
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="py-16 text-center space-y-2.5 border border-dashed border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {activeTab === "active" ? "All Operational Metrics Healthy" : "No Snoozed Alerts"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeTab === "active"
                ? "Zero active SLA breaches or unmitigated capacity bottlenecks detected across the 12 rule criteria."
                : "No alerts have been temporarily muted."}
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

      {/* 5. 12-Rule Registry Modal */}
      <AlertsRuleRegistryModal
        isOpen={isRegistryOpen}
        onClose={() => setIsRegistryOpen(false)}
      />
    </div>
  );
}

