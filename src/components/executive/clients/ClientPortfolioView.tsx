import React from "react";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { Briefcase, AlertTriangle, ExternalLink } from "lucide-react";
import { ClientPortfolioItem } from "@/hooks/useComplianceAndClientData";
import { useNavigate } from "react-router-dom";

interface ClientPortfolioViewProps {
  clients: ClientPortfolioItem[];
}

export function ClientPortfolioView({ clients }: ClientPortfolioViewProps) {
  const navigate = useNavigate();

  // Pareto Concentration Data
  const paretoData = clients.slice(0, 8).map((c) => ({
    name: c.name.length > 12 ? `${c.name.substring(0, 10)}...` : c.name,
    concentration: c.concentrationPercent,
    hours: c.periodHours,
    isFlagged: c.isHighConcentration,
  }));

  const hasHighConcentrationRisk = clients.some((c) => c.isHighConcentration);

  return (
    <div className="space-y-4">
      {/* Risk Alert Banner (Blueprint Section 2.6: Flags client > 25% of company hours) */}
      {hasHighConcentrationRisk && (
        <div className="p-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Client Concentration Risk:</strong> One or more clients account for &gt;25% of company logged hours. Diversification recommended.
            </span>
          </div>
          <Badge variant="outline" className="border-amber-300 text-amber-800 font-semibold text-[10px]">
            Pareto Threshold Breached
          </Badge>
        </div>
      )}

      {/* 1. Client Concentration Pareto Chart */}
      <AnalyticsChartCard
        question="How dependent is our organization on our top client accounts?"
        title="Client Concentration & Revenue Dependency (Pareto View)"
        subtitle="Share of total company logged hours by client account against 25% dependency threshold"
        formula="(Client Logged Hours / Total Company Logged Hours) × 100"
        target="No single client > 25%"
        targetMet={!hasHighConcentrationRisk}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Client</th>
                <th className="py-1.5 font-medium text-right">Logged Hours</th>
                <th className="py-1.5 font-medium text-right">Company Share</th>
                <th className="py-1.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="py-1.5 font-semibold">{c.name}</td>
                  <td className="py-1.5 text-right font-mono">{c.periodHours}h</td>
                  <td className="py-1.5 text-right font-bold">{c.concentrationPercent}%</td>
                  <td className="py-1.5 text-center">
                    <span className={c.isHighConcentration ? "text-rose-600 font-bold" : "text-emerald-600"}>
                      {c.isHighConcentration ? "> 25% Concentration" : "Balanced"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-56 w-full">
          {paretoData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No client hours recorded in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paretoData} margin={{ top: 15, right: 20, bottom: 5, left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(val: any) => [`${val}%`, "Company Share"]} />
                <ReferenceLine
                  y={25}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: "Max Cap (25%)", fill: "#ef4444", fontSize: 10, position: "top" }}
                />
                <Bar dataKey="concentration" radius={[4, 4, 0, 0]}>
                  {paretoData.map((entry, index) => (
                    <Cell key={`cell-pareto-${index}`} fill={entry.isFlagged ? "#ef4444" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>

      {/* 2. Client Portfolio Master Table */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Client Portfolio Directory</h4>
              <p className="text-[11px] text-muted-foreground">
                Active client accounts, total hours delivered, and open collaboration items
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {clients.length} Clients
          </Badge>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2.5 font-medium">Client Account</th>
                <th className="py-2.5 font-medium text-center">Status</th>
                <th className="py-2.5 font-medium text-right">Active Projects</th>
                <th className="py-2.5 font-medium text-right">Hours Logged</th>
                <th className="py-2.5 font-medium text-right">Portfolio Share</th>
                <th className="py-2.5 font-medium text-right">Pending Action Items</th>
                <th className="py-2.5 font-medium text-right pr-1">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No clients configured in database.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                    <td className="py-2.5 font-semibold text-foreground">{c.name}</td>
                    <td className="py-2.5 text-center">
                      <Badge variant="outline" className="text-[9.5px] uppercase">
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right font-medium">{c.activeProjectsCount}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-foreground">{c.periodHours}h</td>
                    <td className="py-2.5 text-right font-bold">
                      <span className={c.isHighConcentration ? "text-rose-600" : "text-primary"}>
                        {c.concentrationPercent}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {c.pendingActionItems > 0 ? (
                        <span className="text-amber-600 font-semibold">{c.pendingActionItems} open</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right pr-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary font-medium"
                        onClick={() => navigate("/clients")}
                      >
                        View Account <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

