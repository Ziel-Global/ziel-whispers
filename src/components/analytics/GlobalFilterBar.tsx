import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  FolderKanban,
  Users,
  Briefcase,
  GitCommit,
} from "lucide-react";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { DateRangePreset, ComparisonType, Granularity } from "@/lib/analytics-filter-utils";
import { DataTrustBadge } from "./DataTrustBadge";
import { SavedViewsDropdown } from "./SavedViewsDropdown";

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  mtd: "Month to Date",
  last_month: "Last Month",
  qtd: "Quarter to Date",
  last_quarter: "Last Quarter",
  ytd: "Year to Date",
  last_30_days: "Last 30 Days",
  last_90_days: "Last 90 Days",
  custom: "Custom Range",
};

export interface GlobalFilterBarProps {
  className?: string;
  complianceRate?: number;
  loggedHours?: number;
  expectedHours?: number;
  missingHours?: number;
  showDataTrustBadge?: boolean;
}

export function GlobalFilterBar({
  className = "",
  complianceRate,
  loggedHours,
  expectedHours,
  missingHours,
  showDataTrustBadge = true,
}: GlobalFilterBarProps) {
  const filterHook = useAnalyticsFilters();
  const {
    filters,
    resolvedRange,
    activeFilterCount,
    clients,
    projects,
    sprints,
    departments,
    roles,
    employees,
    setPreset,
    setComparison,
    setGranularity,
    setClientId,
    setProjectId,
    setSprintId,
    setDepartment,
    setRole,
    setUserId,
    setWorkMode,
    setBillableOnly,
    clearNonDateFilters,
    applySavedFilterState,
  } = filterHook;

  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customStart, setCustomStart] = useState(filters.customStartDate || resolvedRange.startDate);
  const [customEnd, setCustomEnd] = useState(filters.customEndDate || resolvedRange.endDate);

  const selectedClient = clients.find((c) => c.id === filters.clientId);
  const selectedProject = projects.find((p) => p.id === filters.projectId);
  const selectedSprint = sprints.find((s) => s.id === filters.sprintId);
  const selectedEmployee = employees.find((e) => e.id === filters.userId);

  return (
    <div className={`space-y-2.5 w-full ${className}`}>
      {/* Primary Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-card border border-black/[0.08] dark:border-white/[0.08] p-2.5 rounded-xl shadow-sm">
        {/* Left Side: Date Presets & Range */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold px-3 border-black/[0.1] dark:border-white/[0.1] flex items-center gap-2"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{PRESET_LABELS[filters.preset]}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 text-xs p-1">
              {(
                [
                  "mtd",
                  "last_30_days",
                  "last_month",
                  "this_week",
                  "last_week",
                  "qtd",
                  "last_quarter",
                  "last_90_days",
                  "ytd",
                  "today",
                  "yesterday",
                ] as DateRangePreset[]
              ).map((presetKey) => (
                <DropdownMenuItem
                  key={presetKey}
                  onClick={() => setPreset(presetKey)}
                  className={`cursor-pointer px-2 py-1.5 ${filters.preset === presetKey ? "font-bold text-primary" : ""}`}
                >
                  {PRESET_LABELS[presetKey]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => setCustomRangeOpen(true)}
                className={`cursor-pointer px-2 py-1.5 border-t mt-1 ${filters.preset === "custom" ? "font-bold text-primary" : ""}`}
              >
                Custom Range…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Custom Range Dialog Popover */}
          <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
            <PopoverTrigger asChild>
              <span className="text-xs text-muted-foreground font-medium px-1 cursor-pointer hover:text-foreground">
                {resolvedRange.label}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 text-xs space-y-3" align="start">
              <p className="font-bold text-foreground">Select Custom Date Range</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Start Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">End Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCustomRangeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setPreset("custom", customStart, customEnd);
                    setCustomRangeOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Comparison Selector */}
          <Select
            value={filters.comparison}
            onValueChange={(val: ComparisonType) => setComparison(val)}
          >
            <SelectTrigger className="h-8 text-xs font-semibold px-2.5 w-auto border-black/[0.1] dark:border-white/[0.1] gap-1.5">
              <SelectValue placeholder="Compare" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="none">No Comparison</SelectItem>
              <SelectItem value="previous_period">vs. Previous Period</SelectItem>
              <SelectItem value="same_period_last_year">vs. Same Period Last Year</SelectItem>
            </SelectContent>
          </Select>

          {/* Granularity Selector */}
          <div className="hidden lg:flex items-center bg-muted/60 p-0.5 rounded-lg border border-black/[0.04]">
            {(["day", "week", "month", "quarter"] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`h-7 px-2.5 text-[11px] font-semibold rounded-md capitalize transition-all ${
                  filters.granularity === g
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Cascading Filters Popover, Saved Views, Data Trust */}
        <div className="flex items-center gap-2">
          {/* Cascading Filter Trigger */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={activeFilterCount > 0 ? "secondary" : "outline"}
                size="sm"
                className={`h-8 text-xs font-semibold px-3 gap-1.5 ${
                  activeFilterCount > 0 ? "border-primary/40 text-primary bg-primary/5" : ""
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-80 p-4 space-y-3.5 text-xs shadow-lg" align="end">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-primary" /> Filter Scope
                </span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] p-0 text-muted-foreground hover:text-foreground"
                    onClick={clearNonDateFilters}
                  >
                    Reset filters
                  </Button>
                )}
              </div>

              {/* 1. Client Filter */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Client
                </Label>
                <Select value={filters.clientId || "all"} onValueChange={(v) => setClientId(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent className="text-xs max-h-48">
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Project Filter (Cascaded) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" /> Project
                </Label>
                <Select value={filters.projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent className="text-xs max-h-48">
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Sprint Filter (Cascaded) */}
              {filters.projectId && sprints.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <GitCommit className="h-3 w-3" /> Sprint
                  </Label>
                  <Select value={filters.sprintId || "all"} onValueChange={(v) => setSprintId(v === "all" ? null : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All Sprints" />
                    </SelectTrigger>
                    <SelectContent className="text-xs max-h-48">
                      <SelectItem value="all">All Sprints</SelectItem>
                      {sprints.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 4. Department Filter */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Department
                </Label>
                <Select value={filters.department || "all"} onValueChange={(v) => setDepartment(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="text-xs max-h-48">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Employee Filter */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Employee
                </Label>
                <Select value={filters.userId || "all"} onValueChange={(v) => setUserId(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent className="text-xs max-h-48">
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 6. Work Mode & Billable Only Switch */}
              <div className="pt-2 border-t space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="billable-switch" className="text-xs font-semibold cursor-pointer">
                    Billable Work Only
                  </Label>
                  <Switch
                    id="billable-switch"
                    checked={filters.billableOnly}
                    onCheckedChange={setBillableOnly}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Work Mode</Label>
                  <Select value={filters.workMode} onValueChange={(v: "all" | "onsite" | "remote") => setWorkMode(v)}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="all">All Modes</SelectItem>
                      <SelectItem value="onsite">Onsite Only</SelectItem>
                      <SelectItem value="remote">Remote Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Saved Views Dropdown */}
          <SavedViewsDropdown currentFilters={filters} onApplyView={applySavedFilterState} />

          {/* Data Trust Badge */}
          {showDataTrustBadge && (
            <DataTrustBadge
              complianceRate={complianceRate}
              loggedHours={loggedHours}
              expectedHours={expectedHours}
              missingHours={missingHours}
            />
          )}
        </div>
      </div>

      {/* Active Filter Chips Strip */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-1 text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Active Filters:</span>

          {selectedClient && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Client: {selectedClient.name}
              <button type="button" onClick={() => setClientId(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedProject && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Project: {selectedProject.name}
              <button type="button" onClick={() => setProjectId(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedSprint && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Sprint: {selectedSprint.name}
              <button type="button" onClick={() => setSprintId(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.department && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Dept: {filters.department}
              <button type="button" onClick={() => setDepartment(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.role && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Role: {filters.role}
              <button type="button" onClick={() => setRole(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedEmployee && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Employee: {selectedEmployee.full_name}
              <button type="button" onClick={() => setUserId(null)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.workMode !== "all" && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium capitalize">
              Mode: {filters.workMode}
              <button type="button" onClick={() => setWorkMode("all")} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.billableOnly && (
            <Badge variant="secondary" className="gap-1 text-[11px] py-0.5 font-medium">
              Billable Only
              <button type="button" onClick={() => setBillableOnly(false)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive ml-1"
            onClick={clearNonDateFilters}
          >
            <RotateCcw className="h-2.5 w-2.5 mr-1" /> Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
