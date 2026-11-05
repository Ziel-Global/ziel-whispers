import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BLUEPRINT_REPORTS_REGISTRY, ReportDefinition } from "@/lib/reports/reportDefinitions";
import { Calendar, Clock, Send, Plus, Trash2, CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";

export interface ScheduledDeliveryItem {
  id: string;
  reportId: string;
  reportTitle: string;
  cadence: "daily" | "weekly" | "monthly";
  timeOfDay: string;
  channel: "slack" | "email" | "in_app";
  destination: string;
  format: "pdf" | "csv" | "xlsx";
  isActive: boolean;
  lastRun?: string;
}

const STORAGE_KEY = "ziel_scheduled_reports_v1";

const DEFAULT_SCHEDULES: ScheduledDeliveryItem[] = [
  {
    id: "sched-1",
    reportId: "REPORT_01_EXEC_WEEKLY",
    reportTitle: "Executive Weekly Brief",
    cadence: "weekly",
    timeOfDay: "08:00 AM (Mondays)",
    channel: "slack",
    destination: "#executive-briefs",
    format: "pdf",
    isActive: true,
    lastRun: "Yesterday, 08:00 AM",
  },
  {
    id: "sched-2",
    reportId: "REPORT_02_MONTHLY_BUSINESS",
    reportTitle: "Monthly Business Review (MBR)",
    cadence: "monthly",
    timeOfDay: "1st of Month, 09:00 AM",
    channel: "email",
    destination: "leadership@ziel.com",
    format: "pdf",
    isActive: true,
    lastRun: "Nov 01, 2026",
  },
  {
    id: "sched-3",
    reportId: "REPORT_10_COMPLIANCE_EXCEPTIONS",
    reportTitle: "Operational Compliance Exceptions",
    cadence: "weekly",
    timeOfDay: "Friday, 05:00 PM",
    channel: "in_app",
    destination: "All Department Managers",
    format: "xlsx",
    isActive: true,
    lastRun: "Oct 31, 2026",
  },
];

interface ScheduledReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduledReportsModal({ isOpen, onClose }: ScheduledReportsModalProps) {
  const [schedules, setSchedules] = useState<ScheduledDeliveryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SCHEDULES;
    } catch {
      return DEFAULT_SCHEDULES;
    }
  });

  const [selectedReportId, setSelectedReportId] = useState<string>("REPORT_01_EXEC_WEEKLY");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [channel, setChannel] = useState<"slack" | "email" | "in_app">("slack");
  const [destination, setDestination] = useState<string>("#leadership-ops");

  const saveSchedules = (items: ScheduledDeliveryItem[]) => {
    setSchedules(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSchedule = () => {
    const report = BLUEPRINT_REPORTS_REGISTRY.find((r) => r.id === selectedReportId);
    if (!report) return;

    const newItem: ScheduledDeliveryItem = {
      id: `sched-${Date.now()}`,
      reportId: report.id,
      reportTitle: report.title,
      cadence,
      timeOfDay: cadence === "weekly" ? "Monday, 08:30 AM" : cadence === "monthly" ? "1st of Month" : "Daily 09:00 AM",
      channel,
      destination: destination || "default",
      format: report.defaultFormat,
      isActive: true,
    };

    saveSchedules([...schedules, newItem]);
    toast.success(`Scheduled delivery created for ${report.title}`);
  };

  const toggleScheduleActive = (id: string) => {
    const updated = schedules.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s));
    saveSchedules(updated);
  };

  const deleteSchedule = (id: string) => {
    saveSchedules(schedules.filter((s) => s.id !== id));
    toast.info("Schedule deleted");
  };

  const runImmediateTest = (s: ScheduledDeliveryItem) => {
    toast.success(`[Scheduled Dispatch Triggered] "${s.reportTitle}" dispatched to ${s.destination} via ${s.channel.toUpperCase()}!`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Automated Scheduled Deliveries
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure recurrent delivery of the 13 blueprint reports to Slack, Email, or In-App
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-1">
          {/* Create New Schedule Card */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-primary" /> Create New Automated Delivery Schedule
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2">
                <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Select Report" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLUEPRINT_REPORTS_REGISTRY.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.code} • {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={cadence} onValueChange={(v) => setCadence(v as any)}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Cadence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily" className="text-xs">Daily (9:00 AM)</SelectItem>
                    <SelectItem value="weekly" className="text-xs">Weekly (Mon 8:00 AM)</SelectItem>
                    <SelectItem value="monthly" className="text-xs">Monthly (1st)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack" className="text-xs">Slack Channel</SelectItem>
                    <SelectItem value="email" className="text-xs">Email List</SelectItem>
                    <SelectItem value="in_app" className="text-xs">In-App Notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={channel === "slack" ? "#channel-name" : "email@domain.com"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="h-8 text-xs bg-background flex-1"
              />
              <Button size="sm" onClick={handleCreateSchedule} className="h-8 text-xs gap-1 font-semibold">
                <Plus className="h-3.5 w-3.5" /> Save Schedule
              </Button>
            </div>
          </div>

          {/* Existing Schedules List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Active Schedules ({schedules.length})
            </h4>

            {schedules.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-card text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs">{s.reportTitle}</span>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold">
                      {s.format}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.timeOfDay}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground">
                      Destination: {s.destination} ({s.channel})
                    </span>
                    {s.lastRun && (
                      <>
                        <span>•</span>
                        <span>Last run: {s.lastRun}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runImmediateTest(s)}
                    className="h-7 text-[11px] gap-1 px-2 text-primary"
                    title="Send immediate test dispatch"
                  >
                    <Play className="h-3 w-3" /> Run Now
                  </Button>

                  <Switch
                    checked={s.isActive}
                    onCheckedChange={() => toggleScheduleActive(s.id)}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSchedule(s.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

