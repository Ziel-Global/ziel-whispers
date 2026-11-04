import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateProjectFinancials,
  DEFAULT_COST_RATES,
  DEFAULT_BILL_RATE,
} from "@/lib/financialEngine";
import { DollarSign, TrendingUp, CreditCard, PieChart } from "lucide-react";

export function ProjectProfitabilityTable() {
  // 1. Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ["profitability-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, is_billable, billing_type, budget_hours, client_id, clients (name)")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Logs
  const { data: logs = [] } = useQuery({
    queryKey: ["profitability-logs"],
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
  const { data: users = [] } = useQuery({
    queryKey: ["profitability-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, role")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const costRates = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => {
      map.set(u.id, DEFAULT_COST_RATES[u.role || "employee"] || 35);
    });
    return map;
  }, [users]);

  const { projectFinancials, portfolioSummary } = useMemo(() => {
    return evaluateProjectFinancials(projects as any, logs as any, costRates);
  }, [projects, logs, costRates]);

  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            Financial Margins & Profitability
          </h3>
          <p className="text-xs text-muted-foreground">
            Revenue vs. internal labor cost based on ${DEFAULT_BILL_RATE}/h standard billing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            Portfolio Margin: {portfolioSummary.portfolioGrossMarginPct}%
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs font-semibold ${
              portfolioSummary.marginBand === "healthy"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : portfolioSummary.marginBand === "watch"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {portfolioSummary.marginBand === "healthy" ? "Healthy Target Met" : portfolioSummary.marginBand === "watch" ? "Watch Margin" : "Low Margin"}
          </Badge>
        </div>
      </div>

      {/* Mini 4-KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Revenue</span>
          <p className="text-base font-bold text-foreground mt-0.5">${portfolioSummary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Labor Cost</span>
          <p className="text-base font-bold text-foreground mt-0.5">${portfolioSummary.totalLaborCost.toLocaleString()}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Gross Profit</span>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">${portfolioSummary.totalGrossProfit.toLocaleString()}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Target Margin</span>
          <p className="text-base font-bold text-primary mt-0.5">≥ 45% SSoT</p>
        </div>
      </div>

      {/* Profitability Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-semibold">Project</th>
              <th className="py-2 font-semibold">Client</th>
              <th className="py-2 text-right font-semibold">Logged</th>
              <th className="py-2 text-right font-semibold">Revenue</th>
              <th className="py-2 text-right font-semibold">Labor Cost</th>
              <th className="py-2 text-right font-semibold">Profit</th>
              <th className="py-2 text-center font-semibold">Margin %</th>
              <th className="py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {projectFinancials.map((p) => (
              <tr key={p.projectId} className="hover:bg-black/[0.015]">
                <td className="py-2.5 font-semibold text-foreground">{p.projectName}</td>
                <td className="py-2.5 text-muted-foreground">{p.clientName}</td>
                <td className="py-2.5 text-right font-mono text-muted-foreground">{p.loggedHours}h</td>
                <td className="py-2.5 text-right font-mono font-bold text-foreground">${p.revenue.toLocaleString()}</td>
                <td className="py-2.5 text-right font-mono text-muted-foreground">${p.laborCost.toLocaleString()}</td>
                <td className={`py-2.5 text-right font-mono font-bold ${p.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  ${p.grossProfit.toLocaleString()}
                </td>
                <td className="py-2.5 text-center font-mono font-bold">{p.grossMarginPct}%</td>
                <td className="py-2.5 text-center">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${
                      p.marginBand === "healthy"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : p.marginBand === "watch"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {p.marginBand === "healthy" ? "Healthy" : p.marginBand === "watch" ? "Watch" : "Low Margin"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

