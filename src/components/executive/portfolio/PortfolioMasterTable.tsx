import React, { useState, useMemo } from "react";
import { ProjectPortfolioItem } from "@/hooks/useProjectAndDeliveryData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PortfolioMasterTableProps {
  projects: ProjectPortfolioItem[];
}

type SortField = "name" | "burnPercentage" | "progressPercentage" | "budgetHours" | "loggedHours" | "scheduleVarianceDays";

export function PortfolioMasterTable({ projects }: PortfolioMasterTableProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("burnPercentage");
  const [sortAsc, setSortAsc] = useState(false);
  const [healthFilter, setHealthFilter] = useState<string>("all");

  const filteredAndSortedProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.clientName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesHealth = healthFilter === "all" || p.scheduleHealth === healthFilter;
        return matchesSearch && matchesHealth;
      })
      .sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        if (typeof aVal === "string") {
          return sortAsc
            ? (aVal as string).localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal as string);
        }
        return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
  }, [projects, searchTerm, sortField, sortAsc, healthFilter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
      {/* Table Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Project Portfolio Master</h3>
            <p className="text-[11px] text-muted-foreground">
              Real-time schedule variance, budget burn, and active delivery risks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search projects or clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs rounded-lg"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={healthFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-[11px] px-2.5 font-medium"
              onClick={() => setHealthFilter("all")}
            >
              All ({projects.length})
            </Button>
            <Button
              variant={healthFilter === "at_risk" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-[11px] px-2.5 font-medium text-amber-600"
              onClick={() => setHealthFilter("at_risk")}
            >
              At Risk
            </Button>
            <Button
              variant={healthFilter === "delayed" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-[11px] px-2.5 font-medium text-rose-600"
              onClick={() => setHealthFilter("delayed")}
            >
              Delayed
            </Button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2.5 font-medium pl-1">
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Project / Client <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 font-medium text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("burnPercentage")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Burn % <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 font-medium text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("progressPercentage")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground"
                >
                  Progress <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-2.5 font-medium text-right">Hours Logged / Budget</th>
              <th className="py-2.5 font-medium text-center">Schedule Health</th>
              <th className="py-2.5 font-medium text-center">Budget Health</th>
              <th className="py-2.5 font-medium text-right">Blockers</th>
              <th className="py-2.5 font-medium text-right pr-1">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {filteredAndSortedProjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No projects matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredAndSortedProjects.map((p) => {
                const isDelayed = p.scheduleHealth === "delayed";
                const isAtRisk = p.scheduleHealth === "at_risk";
                const isOverBudget = p.budgetHealth === "over_budget";

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors ${
                      isDelayed
                        ? "bg-rose-50/20 dark:bg-rose-950/10"
                        : isAtRisk
                        ? "bg-amber-50/20 dark:bg-amber-950/10"
                        : ""
                    }`}
                  >
                    <td className="py-2.5 pl-1">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {p.code} • {p.clientName}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 text-right font-medium">
                      <span
                        className={
                          p.burnPercentage > 100
                            ? "text-rose-600 font-bold"
                            : p.burnPercentage > 85
                            ? "text-amber-600 font-bold"
                            : "text-foreground"
                        }
                      >
                        {p.burnPercentage}%
                      </span>
                    </td>

                    <td className="py-2.5 text-right font-medium">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-full"
                            style={{ width: `${Math.min(100, p.progressPercentage)}%` }}
                          />
                        </div>
                        <span className="text-foreground">{p.progressPercentage}%</span>
                      </div>
                    </td>

                    <td className="py-2.5 text-right text-muted-foreground">
                      <span className="font-semibold text-foreground">{p.loggedHours}h</span>
                      <span> / {p.budgetHours > 0 ? `${p.budgetHours}h` : "No limit"}</span>
                    </td>

                    <td className="py-2.5 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 font-medium ${
                          isDelayed
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                            : isAtRisk
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                        }`}
                      >
                        {isDelayed ? "Delayed" : isAtRisk ? "At Risk" : "Healthy"}
                      </Badge>
                    </td>

                    <td className="py-2.5 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 font-medium ${
                          isOverBudget
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                        }`}
                      >
                        {isOverBudget ? "Over Budget" : "On Budget"}
                      </Badge>
                    </td>

                    <td className="py-2.5 text-right font-semibold">
                      {p.openBlockersCount > 0 ? (
                        <span className="text-rose-600">{p.openBlockersCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>

                    <td className="py-2.5 text-right pr-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary font-medium"
                        onClick={() => navigate(`/projects/${p.code || p.id}`)}
                      >
                        Details <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

