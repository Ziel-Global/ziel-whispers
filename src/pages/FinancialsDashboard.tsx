import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  evaluateProjectFinancials,
  DEFAULT_COST_RATES,
  DEFAULT_BILL_RATE,
} from "@/lib/financialEngine";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function FinancialsDashboardPage() {
  const [billRateMap, setBillRateMap] = useState<Map<string, number>>(new Map());
  const [costRateMap, setCostRateMap] = useState<Map<string, number>>(new Map());

  // 1. Fetch Projects
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["financials-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, is_billable, billing_type, budget_hours, client_id, clients (name)")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Daily Logs
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["financials-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, user_id, project_id, hours")
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch Users
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["financials-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, department, designation")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Initialize cost rates map
  const activeCostRates = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => {
      const userRole = u.role || "employee";
      const defaultRate = DEFAULT_COST_RATES[userRole] || 35;
      map.set(u.id, costRateMap.get(u.id) || defaultRate);
    });
    return map;
  }, [users, costRateMap]);

  // Evaluate Financials
  const { projectFinancials, portfolioSummary } = useMemo(() => {
    return evaluateProjectFinancials(projects as any, logs as any, activeCostRates, billRateMap);
  }, [projects, logs, activeCostRates, billRateMap]);

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", href: "/analytics" },
    { label: "Financial Margins & Profitability", level: "company" },
  ];

  const isLoading = loadingProjects || loadingLogs || loadingUsers;

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Project Financials & Gross Margin Hub
          </h1>
          <p className="text-xs text-muted-foreground">
            Role-based labor costing, billable revenue tracking, and portfolio profitability analysis
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs font-mono py-1 px-2.5">
            Client Bill Rate: ${DEFAULT_BILL_RATE}/h SSoT
          </Badge>
        </div>
      </div>

      {/* 2. Top-Level Financial KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Revenue */}
        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
              Total Revenue
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                ${portfolioSummary.totalRevenue.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Billable client deliveries</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>

        {/* Total Labor Cost */}
        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
              Total Labor Cost
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                ${portfolioSummary.totalLaborCost.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Internal fully-burdened cost</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <CreditCard className="h-5 w-5" />
          </div>
        </Card>

        {/* Gross Profit */}
        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
              Gross Profit
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  portfolioSummary.totalGrossProfit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                ${portfolioSummary.totalGrossProfit.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Net operating earnings</p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </Card>

        {/* Gross Margin % */}
        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
              Portfolio Margin
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  portfolioSummary.marginBand === "healthy"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : portfolioSummary.marginBand === "watch"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {portfolioSummary.portfolioGrossMarginPct}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Target: &ge; 45% Gross Margin</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <PieChart className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* 3. Detailed Project Financials Table */}
      <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Project Profitability & Cost Breakdown
            </h3>
            <p className="text-xs text-muted-foreground">
              Live margin performance calculated from logged task hours and role hourly cost rates
            </p>
          </div>

          <Badge variant="outline" className="text-xs font-semibold">
            {projectFinancials.length} Projects Analyzed
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2.5 font-semibold">Project Name</th>
                <th className="py-2.5 font-semibold">Client</th>
                <th className="py-2.5 font-semibold text-center">Type</th>
                <th className="py-2.5 font-semibold text-right">Logged (h)</th>
                <th className="py-2.5 font-semibold text-right">Revenue</th>
                <th className="py-2.5 font-semibold text-right">Labor Cost</th>
                <th className="py-2.5 font-semibold text-right">Profit</th>
                <th className="py-2.5 font-semibold text-center">Margin %</th>
                <th className="py-2.5 font-semibold text-center">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {projectFinancials.map((p) => {
                const isHealthy = p.marginBand === "healthy";
                const isWatch = p.marginBand === "watch";

                return (
                  <tr key={p.projectId} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                    <td className="py-3 font-semibold text-foreground">{p.projectName}</td>
                    <td className="py-3 text-muted-foreground">{p.clientName}</td>
                    <td className="py-3 text-center">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {p.billingType}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">{p.loggedHours}h</td>
                    <td className="py-3 text-right font-mono font-bold text-foreground">
                      ${p.revenue.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      ${p.laborCost.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 text-right font-mono font-bold ${
                        p.grossProfit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      ${p.grossProfit.toLocaleString()}
                    </td>
                    <td className="py-3 text-center font-mono font-bold">{p.grossMarginPct}%</td>
                    <td className="py-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          isHealthy
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : isWatch
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        {isHealthy ? "Healthy" : isWatch ? "Watch" : "Low Margin"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

