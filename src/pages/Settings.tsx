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
