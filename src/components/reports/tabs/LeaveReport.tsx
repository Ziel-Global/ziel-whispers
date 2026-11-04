import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Camera, Search, TrendingUp, Check, AlertCircle, Clock } from "lucide-react";
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  subDays,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { getPKTDateString, formatPKTTime, formatTime12h } from "@/hooks/useWorkSettings";
import { CATEGORIES } from "@/utils/logDateUtils";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/constants";
import {
  humanizeCategory,
  utilStatusFromPct,
  utilStatusBadgeClass,
  initialsFromName,
  exportCSV,
  exportPNG,
  getWorkingDays,
  smoothPath,
  type UtilStatus,
} from "./legacyReportHelpers";

export function LeaveReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dept, setDept] = useState("all");

  const { data: leaveTypes } = useQuery({
    queryKey: ["leave-report-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["leave-report", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, days_count, status, reason, leave_type_id, user_id, users(full_name, department), leave_types(name)")
        .lte("start_date", endDate)
        .gte("end_date", startDate)
        .order("start_date", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r) => {
      if (typeFilter !== "all" && r.leave_type_id !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const userDept = (r.users as any)?.department || "Other";
      if (dept !== "all" && userDept !== dept) return false;
      return true;
    });
  }, [requests, typeFilter, statusFilter, dept]);

  const kpis = useMemo(() => {
    const approvedDays = filtered
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + Number(r.days_count || 0), 0);
    const total = filtered.length;
    const pending = filtered.filter((r) => r.status === "pending").length;
    const approved = filtered.filter((r) => r.status === "approved").length;
    const rejected = filtered.filter((r) => r.status === "rejected").length;
    const decided = approved + rejected;
    const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;
    return {
      approvedDays: Math.round(approvedDays * 10) / 10,
      total,
      pending,
      approvalRate,
      approved,
      rejected,
    };
  }, [filtered]);

  const typeRows = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const name = (r.leave_types as any)?.name || "Unknown";
      map[name] = (map[name] || 0) + Number(r.days_count || 0);
    });
    const max = Math.max(1, ...Object.values(map));
    return Object.entries(map)
      .map(([name, days]) => ({
        name,
        days: Math.round(days * 10) / 10,
        pct: Math.round((days / max) * 100),
      }))
      .sort((a, b) => b.days - a.days);
  }, [filtered]);

  const statusMix = useMemo(() => {
    const total = kpis.total || 1;
    const approvedPct = Math.round((kpis.approved / total) * 100);
    const pendingPct = Math.round((kpis.pending / total) * 100);
    const rejectedPct = Math.max(0, 100 - approvedPct - pendingPct);
    return { approvedPct, pendingPct, rejectedPct };
  }, [kpis]);

  const statusDonut =
    kpis.total === 0
      ? "#EFEFF2"
      : `conic-gradient(#17171A 0 ${statusMix.approvedPct}%, #EB5A1E ${statusMix.approvedPct}% ${statusMix.approvedPct + statusMix.pendingPct}%, #E8E8EB ${statusMix.approvedPct + statusMix.pendingPct}% 100%)`;


  return (
    <div className="space-y-3.5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {[
          { label: "Leave Days", value: String(kpis.approvedDays), sub: "Approved in selected period" },
          { label: "Requests", value: String(kpis.total), sub: "Across all types" },
          { label: "Pending", value: String(kpis.pending), sub: "Needs review" },
          { label: "Approval Rate", value: `${kpis.approvalRate}%`, sub: "For selected range" },
        ].map((k) => (
          <MetricCard key={k.label} label={k.label} value={k.value} sub={k.sub} />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Start</div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">End</div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Leave Type</div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {leaveTypes?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          onClick={() =>
            exportCSV(
              filtered.map((r) => ({
                Employee: (r.users as any)?.full_name,
                Type: (r.leave_types as any)?.name,
                From: r.start_date,
                To: r.end_date,
                Days: r.days_count,
                Status: r.status,
                Department: (r.users as any)?.department || "",
              })),
              "leave-report.csv"
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          CSV Export
        </Button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Leave Days by Type</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Approved and requested days in the selected period</div>
          </div>
          <div className="text-[8px] text-[#9A9AA0] mb-2 pl-[120px]">Leave days →</div>
          {typeRows.length === 0 ? (
            <p className="text-[12px] text-[#8B8B92] py-8 text-center">No leave type data</p>
          ) : (
            <div className="space-y-2.5">
              {typeRows.map((row, i) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <div className="w-[110px] shrink-0 text-[11px] font-medium text-[#55555C] truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[#F0F0F2] overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, row.pct)}%`,
                        background: i === 1 ? "#EB5A1E" : "#17171A",
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-[11px] font-semibold text-[#333338]">{row.days}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Request Status</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Current approval position for leave requests</div>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start pt-2">
            <div className="relative w-[130px] h-[130px] rounded-full shrink-0" style={{ background: statusDonut }}>
              <div className="absolute inset-[28px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_0_0_1px_#F0F0F2]">
                <b className="text-[20px] font-bold text-[#17171A] leading-none">{kpis.total}</b>
                <span className="text-[9px] text-[#8B8B92] mt-0.5">requests</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 min-w-[140px]">
              {[
                { label: "Approved", value: kpis.approved, color: "#17171A" },
                { label: "Pending", value: kpis.pending, color: "#EB5A1E" },
                { label: "Rejected", value: kpis.rejected, color: "#E8E8EB" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-[11px] text-[#55555C]">
                  <i className="w-2 h-2 rounded-full shrink-0 not-italic" style={{ background: s.color }} />
                  <span className="flex-1">{s.label}</span>
                  <b className="text-[11px] font-semibold text-[#17171A]">{s.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div
              className={cn(filtered.length > 8 && "max-h-[470px] overflow-y-auto")}
              style={{ scrollbarGutter: "stable" }}
            >
              <div
                className="sticky top-0 z-10 grid items-center gap-3 bg-[#F8F7F6] border-b border-black/[0.07] min-h-[38px] px-[13px] text-[9px] font-bold text-[#A0A0A7] tracking-[0.055em]"
                style={{ gridTemplateColumns: "minmax(180px,1.1fr) 150px 125px 125px 80px 100px" }}
              >
                <div>EMPLOYEE</div>
                <div>TYPE</div>
                <div>FROM</div>
                <div>TO</div>
                <div className="text-center">DAYS</div>
                <div className="text-center">STATUS</div>
              </div>
              {filtered.length === 0 ? (
                <div className="text-center text-[12px] text-[#8B8B92] py-8">No leave requests match the current filters</div>
              ) : (
                filtered.map((r) => (
                  <div
                    key={r.id}
                    className="grid items-center gap-3 min-h-[48px] px-[13px] py-2 border-b border-black/[0.05] last:border-b-0 text-[10.5px] text-[#4B4B52] hover:bg-[#FCFBFA]"
                    style={{ gridTemplateColumns: "minmax(180px,1.1fr) 150px 125px 125px 80px 100px" }}
                  >
                    <div className="font-bold text-[#303035] whitespace-nowrap overflow-hidden text-ellipsis">
                      {(r.users as any)?.full_name || "—"}
                    </div>
                    <div className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                      {(r.leave_types as any)?.name || "—"}
                    </div>
                    <div>{format(parseISO(r.start_date), "MMM d, yyyy")}</div>
                    <div>{format(parseISO(r.end_date), "MMM d, yyyy")}</div>
                    <div className="text-center tabular-nums font-semibold text-[#303035]">{r.days_count}</div>
                    <div className="flex justify-center">
                      <StatusBadge status={r.status} className="min-h-[22px] px-2 text-[8.5px]" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Missed Logs Report ———