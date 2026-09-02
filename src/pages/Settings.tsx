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
import { Save, MapPin } from "lucide-react";
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Attendance Location & Geofencing
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Onsite Latitude</Label>
            <Input
              type="text"
              placeholder="e.g. 33.712417"
              value={val("onsite_latitude", "33.712417")}
              onChange={(e) => set("onsite_latitude", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Office location latitude coordinate</p>
          </div>
          <div className="space-y-1">
            <Label>Onsite Longitude</Label>
            <Input
              type="text"
              placeholder="e.g. 73.039444"
              value={val("onsite_longitude", "73.039444")}
              onChange={(e) => set("onsite_longitude", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Office location longitude coordinate</p>
          </div>
          <div className="space-y-1">
            <Label>Geofence Radius (meters)</Label>
            <Input
              type="number"
              min="10"
              max="5000"
              placeholder="e.g. 300"
              value={val("onsite_radius_meters", "300")}
              onChange={(e) => set("onsite_radius_meters", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Allowed distance radius from office for onsite clock-in</p>
          </div>
          <div className="space-y-1">
            <Label>Enforce Geofence Validation</Label>
            <Select
              value={val("geofence_enabled", "true")}
              onValueChange={(v) => set("geofence_enabled", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Geofence Enforcement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled (Enforce location check)</SelectItem>
                <SelectItem value="false">Disabled (Bypass location check)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Enable or disable location checking for onsite clock-ins</p>
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
    </div>
  );
}
