import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveSettingsSection } from "@/components/settings/LeaveSettingsSection";
import { Save, Send } from "lucide-react";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

type SettingsMap = Record<string, string>;

export default function SettingsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

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
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!profile?.email) return;
    setTestingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: profile.email,
          subject: "Test Email from Ziel Logs",
          html: `<div style="font-family:Arial,sans-serif;padding:20px;"><h2>Test Email</h2><p>This is a test email from Ziel Logs. If you're reading this, email delivery is working correctly.</p></div>`,
        },
      });
      if (error) throw error;
      toast.success(`Test email sent to ${profile.email}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTestingEmail(false);
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

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="shifts">Shift & Log Rules</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="leave">Leave Policy</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">General Settings</h3>
            <div className="space-y-1">
              <Label>App Name</Label>
              <Input value={val("app_name", "Ziel Logs")} onChange={(e) => set("app_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>System Timezone</Label>
              <Select value={val("timezone", "UTC")} onValueChange={(v) => set("timezone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">Shift & Log Rules</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Default Shift Start</Label>
                <Input type="time" value={val("default_shift_start", "09:00")} onChange={(e) => set("default_shift_start", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Default Shift End</Label>
                <Input type="time" value={val("default_shift_end", "18:00")} onChange={(e) => set("default_shift_end", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Grace Period (minutes)</Label>
                <Input type="number" value={val("grace_period_minutes", "30")} onChange={(e) => set("grace_period_minutes", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Log Edit Window (hours)</Label>
                <Input type="number" value={val("log_edit_window_hours", "24")} onChange={(e) => set("log_edit_window_hours", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Missed Log Detection Time</Label>
                <Input type="time" value={val("missed_log_check_time", "19:00")} onChange={(e) => set("missed_log_check_time", e.target.value)} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="utilization">
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
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <LeaveSettingsSection />
        </TabsContent>

        <TabsContent value="email">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">Email Configuration</h3>
            <p className="text-sm text-muted-foreground">Email is configured via Resend API. The API key is stored securely in project secrets.</p>
            <div className="space-y-1">
              <Label>Sender Name</Label>
              <Input value={val("email_sender_name", "Ziel Logs")} onChange={(e) => set("email_sender_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sender Email</Label>
              <Input value={val("email_sender_email", "noreply@resend.dev")} onChange={(e) => set("email_sender_email", e.target.value)} />
            </div>
            <Button variant="outline" onClick={sendTestEmail} disabled={testingEmail}>
              <Send className="h-4 w-4 mr-2" />{testingEmail ? "Sending…" : "Send Test Email"}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
