import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { formatTime12h } from "@/hooks/useWorkSettings";

type SettingsMap = Record<string, string>;

export default function SettingsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);


  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value");
      const map: SettingsMap = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  const [form, setForm] = useState<SettingsMap>({});

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const val = (key: string, fallback = "") => form[key] ?? fallback;
  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await supabase.from("system_settings").upsert(
          { key, value, updated_by: profile?.id },
          { onConflict: "key" }
        );
      }
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.updated",
        target_entity: "system_settings",
        metadata: { keys: Object.keys(form) },
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings-global"] });
      queryClient.invalidateQueries({ queryKey: ["auto-clockout-display-label"] });
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Button onClick={handleSave} disabled={saving} className="rounded-button">
          <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save All"}
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">General Settings</h3>
        <div className="space-y-1">
          <Label>App Name</Label>
          <Input value={val("app_name", "Ziel Logs")} onChange={(e) => set("app_name", e.target.value)} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Default Shift</h3>
        <p className="text-xs text-muted-foreground">Used for employees who do not have a custom shift override.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Default Shift Start</Label>
            <Input type="time" value={val("default_shift_start")} onChange={(e) => set("default_shift_start", e.target.value)} />
            {val("default_shift_start") && <p className="text-xs text-muted-foreground">{formatTime12h(val("default_shift_start"))}</p>}
          </div>
          <div className="space-y-1">
            <Label>Default Shift End</Label>
            <Input type="time" value={val("default_shift_end")} onChange={(e) => set("default_shift_end", e.target.value)} />
            {val("default_shift_end") && <p className="text-xs text-muted-foreground">{formatTime12h(val("default_shift_end"))}</p>}
          </div>
          <div className="space-y-1">
            <Label>Late Grace Period (minutes)</Label>
            <Input type="number" min="0" max="120" value={val("late_grace_minutes")} onChange={(e) => set("late_grace_minutes", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Default Reminder Offset (minutes)</Label>
            <Input type="number" min="1" max="240" value={val("reminder_offset_minutes")} onChange={(e) => set("reminder_offset_minutes", e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Security</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Session Timeout (hours)</Label>
            <Input type="number" min="1" max="48" value={val("session_timeout_hours")} onChange={(e) => set("session_timeout_hours", e.target.value)} />
            <p className="text-xs text-muted-foreground">Auto-logout after inactivity</p>
          </div>
          <div className="space-y-1">
            <Label>Lockout Window (minutes)</Label>
            <Input type="number" min="1" max="240" value={val("lockout_window_minutes")} onChange={(e) => set("lockout_window_minutes", e.target.value)} />
            <p className="text-xs text-muted-foreground">Time window for counting failed logins</p>
          </div>
          <div className="space-y-1">
            <Label>Max Failed Login Attempts</Label>
            <Input type="number" min="1" max="20" value={val("max_failed_login_attempts")} onChange={(e) => set("max_failed_login_attempts", e.target.value)} />
            <p className="text-xs text-muted-foreground">Account locks after this many failures</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Logs & Auto Clock-Out</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Log Edit Window (days)</Label>
            <Input type="number" min="1" max="30" value={val("log_edit_window_days")} onChange={(e) => set("log_edit_window_days", e.target.value)} />
            <p className="text-xs text-muted-foreground">How many past days an employee may log</p>
          </div>
          <div className="space-y-1">
            <Label>Auto Clock-Out Display Time</Label>
            <Input value={val("auto_clockout_display_time")} onChange={(e) => set("auto_clockout_display_time", e.target.value)} placeholder="12:00 AM" />
            <p className="text-xs text-muted-foreground">Time shown in the missed clock-out alert</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Utilization Thresholds</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Underutilized Threshold (%)</Label>
            <Input type="number" value={val("utilization_low", "70")} onChange={(e) => set("utilization_low", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Overburdened Threshold (%)</Label>
            <Input type="number" value={val("utilization_high", "110")} onChange={(e) => set("utilization_high", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Expected Daily Hours</Label>
            <Input type="number" value={val("expected_daily_hours", "8")} onChange={(e) => set("expected_daily_hours", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Annual Leave Entitlement (days)</Label>
            <Input type="number" value={val("annual_leave_entitlement", "12")} onChange={(e) => set("annual_leave_entitlement", e.target.value)} />
          </div>
        </div>
      </Card>
    </div>
  );
}
