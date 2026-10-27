import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";
import { formatTime12h } from "@/hooks/useWorkSettings";

export interface LogRulesTabProps {
  logEditDays: string;
  setLogEditDays: (v: string) => void;
  autoClockoutTime: string;
  setAutoClockoutTime: (v: string) => void;
  expectedHours: string;
  setExpectedHours: (v: string) => void;
  utilLow: string;
  setUtilLow: (v: string) => void;
  utilHigh: string;
  setUtilHigh: (v: string) => void;
  savingSettings: boolean;
  onSave: () => void;
}

export function LogRulesTab({
  logEditDays,
  setLogEditDays,
  autoClockoutTime,
  setAutoClockoutTime,
  expectedHours,
  setExpectedHours,
  utilLow,
  setUtilLow,
  utilHigh,
  setUtilHigh,
  savingSettings,
  onSave,
}: LogRulesTabProps) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] space-y-6 shadow-sm font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-bold text-[14.5px] text-[#17171A] border-b border-black/[0.06] pb-2">
            Log Submission Rules
          </h4>
          <div className="space-y-1">
            <Label className="text-[13px] font-semibold text-[#4B4B52]">
              Log Edit Window (days)
            </Label>
            <Input
              type="number"
              value={logEditDays}
              onChange={(e) => setLogEditDays(e.target.value)}
              min="1"
              max="30"
            />
            <p className="text-[11.5px] text-[#8B8B92]">
              Employees can submit logs for today and up to this many days in the past
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-[13px] font-semibold text-[#4B4B52]">
              Auto Clock-Out Time
            </Label>
            <Input
              type="time"
              value={autoClockoutTime}
              onChange={(e) => setAutoClockoutTime(e.target.value)}
            />
            <p className="text-[11.5px] text-[#8B8B92]">
              Currently: {formatTime12h(autoClockoutTime)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-[14.5px] text-[#17171A] border-b border-black/[0.06] pb-2">
            Reporting Thresholds
          </h4>
          <div className="space-y-1">
            <Label className="text-[13px] font-semibold text-[#4B4B52]">
              Expected Daily Hours
            </Label>
            <Input
              type="number"
              value={expectedHours}
              onChange={(e) => setExpectedHours(e.target.value)}
              min="1"
              max="24"
            />
            <p className="text-[11.5px] text-[#8B8B92]">
              Used to calculate utilization percentages
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-[13px] font-semibold text-[#4B4B52]">
              Underutilized Threshold (%)
            </Label>
            <Input
              type="number"
              value={utilLow}
              onChange={(e) => setUtilLow(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[13px] font-semibold text-[#4B4B52]">
              Overburdened Threshold (%)
            </Label>
            <Input
              type="number"
              value={utilHigh}
              onChange={(e) => setUtilHigh(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={savingSettings}
          className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5 text-white" />
          {savingSettings ? "Saving…" : "Save Rules"}
        </button>
      </div>
    </div>
  );
}
