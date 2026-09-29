/**
 * Settings page — organisation-wide preferences.
 *
 * IMPLEMENTED (persisted via system_settings upsert on Save All):
 *   - app_name
 *   - onsite_latitude, onsite_longitude, onsite_radius_meters, geofence_enabled
 *   - session_timeout_hours, lockout_window_minutes, max_failed_login_attempts
 *
 * FRONTEND TEMPLATE ONLY (local state, not saved):
 *   - System Emails / Manager Digest notification toggles
 *
 * EXCLUDED FROM MOCK:
 *   - Office Geofence map preview (right-column first container)
 *
 * REMAINING FOR FUTURE WORK:
 *   - Persist notification prefs (e.g. system_emails_enabled, manager_digest_enabled)
 *   - Wire email/digest jobs to those keys
 */
import { useState, useEffect, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Settings2, MapPin, Shield, Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsMap = Record<string, string>;

/** Keys that are upserted on Save All. Notification stubs are intentionally excluded. */
const PERSISTED_KEYS = [
  "app_name",
  "onsite_latitude",
  "onsite_longitude",
  "onsite_radius_meters",
  "geofence_enabled",
  "session_timeout_hours",
  "lockout_window_minutes",
  "max_failed_login_attempts",
] as const;

function SettingsToggle({
  on,
  onClick,
  "aria-label": ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative w-[38px] h-[22px] rounded-[20px] shrink-0 transition-colors",
        on ? "bg-[#17171A]" : "bg-[#E5E5E8]"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.16)] transition-[left] duration-150",
          on ? "left-[19px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

function SectionHead({
  icon: Icon,
  title,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <div className="w-[30px] h-[30px] rounded-[9px] bg-[#FFF3ED] text-[#EB5A1E] flex items-center justify-center shrink-0">
        <Icon className="w-[15px] h-[15px]" />
      </div>
      <div>
        <div className="text-[12px] font-bold text-[#17171A]">{title}</div>
        <div className="text-[8.5px] text-[#96969D] mt-0.5 leading-snug">{sub}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-semibold text-[#4B4B52] mb-[5px]">{children}</div>;
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-[8px] text-[#9A9AA0] mt-1 leading-snug">{children}</p>;
}

export default function SettingsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  /**
   * IMPLEMENTED: UI template matching mock Notifications panel.
   * REMAINING: Persist to system_settings (e.g. system_emails_enabled,
   * manager_digest_enabled) and wire email/digest jobs to read these keys.
   * These toggles are local-only and are NOT included in Save All.
   */
  const [systemEmailsOn, setSystemEmailsOn] = useState(true);
  const [managerDigestOn, setManagerDigestOn] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value");
      const map: SettingsMap = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
  });

  const [form, setForm] = useState<SettingsMap>({});

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const val = (key: string, fallback = "") => form[key] ?? fallback;
  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const geofenceEnabled = val("geofence_enabled", "true") === "true";

  const securityBaselineMet =
    Number(val("session_timeout_hours", "0")) > 0 &&
    Number(val("lockout_window_minutes", "0")) > 0 &&
    Number(val("max_failed_login_attempts", "0")) > 0;

  const geofenceReady =
    !!val("onsite_latitude", "33.712417").trim() &&
    !!val("onsite_longitude", "73.039444").trim() &&
    Number(val("onsite_radius_meters", "300")) > 0;

  const notificationsReady = systemEmailsOn || managerDigestOn;

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of PERSISTED_KEYS) {
        const value = form[key] ?? defaultsFor(key);
        await supabase.from("system_settings").upsert(
          { key, value, updated_by: profile?.id },
          { onConflict: "key" }
        );
      }
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.updated",
        target_entity: "system_settings",
        metadata: { keys: [...PERSISTED_KEYS] },
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
      <div className="space-y-3.5">
        <h1 className="text-[26px] font-bold tracking-[-0.55px] text-[#17171A]">Settings</h1>
        <Skeleton className="h-[400px] w-full rounded-[13px]" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.55px] leading-[1.15] text-[#17171A]">Settings</h1>
          <p className="text-[12px] text-[#8B8B92] mt-[5px] leading-relaxed">
            Configure organisation-wide attendance, security and application preferences
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-9 rounded-[10px] bg-[#EB5A1E] hover:bg-[#C64715] text-white hover:text-white text-[12px] font-semibold shadow-sm [&_svg]:!text-white [&_svg]:!stroke-white"
        >
          <Save className="h-4 w-4 mr-1.5 text-white" stroke="currentColor" />
          {saving ? "Saving…" : "Save All"}
        </Button>
      </div>

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] gap-3.5">
        {/* Left stack — wired to system_settings */}
        <div className="flex flex-col gap-3.5 min-w-0">
          <section className="bg-white border border-black/[0.075] rounded-[13px] p-[17px]">
            <SectionHead
              icon={Settings2}
              title="General Settings"
              sub="Core application identity and organisation defaults."
            />
            <div className="grid grid-cols-1 gap-3">
              <div>
                <FieldLabel>App Name</FieldLabel>
                <Input
                  value={val("app_name", "Ziel Logs")}
                  onChange={(e) => set("app_name", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Displayed across the admin and employee applications.</FieldHelp>
              </div>
            </div>
          </section>

          <section className="bg-white border border-black/[0.075] rounded-[13px] p-[17px]">
            <SectionHead
              icon={MapPin}
              title="Attendance Location & Geofencing"
              sub="Control where onsite clock-ins are accepted."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Onsite Latitude</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. 33.712417"
                  value={val("onsite_latitude", "33.712417")}
                  onChange={(e) => set("onsite_latitude", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Office latitude coordinate.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Onsite Longitude</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. 73.039444"
                  value={val("onsite_longitude", "73.039444")}
                  onChange={(e) => set("onsite_longitude", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Office longitude coordinate.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Geofence Radius (meters)</FieldLabel>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  placeholder="e.g. 300"
                  value={val("onsite_radius_meters", "300")}
                  onChange={(e) => set("onsite_radius_meters", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Allowed distance from office for onsite clock-in.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Validation</FieldLabel>
                <div className="flex items-center justify-between gap-3.5 py-[7px]">
                  <div>
                    <div className="text-[10px] font-semibold text-[#17171A]">Enforce Geofence</div>
                    <div className="text-[8.3px] text-[#96969D] mt-0.5 leading-snug">
                      {geofenceEnabled ? "Location check is enforced" : "Location check is bypassed"}
                    </div>
                  </div>
                  <SettingsToggle
                    on={geofenceEnabled}
                    aria-label="Enforce geofence"
                    onClick={() => set("geofence_enabled", geofenceEnabled ? "false" : "true")}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-black/[0.075] rounded-[13px] p-[17px]">
            <SectionHead
              icon={Shield}
              title="Security"
              sub="Organisation-wide session and login protection."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Session Timeout (hours)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={48}
                  value={val("session_timeout_hours")}
                  onChange={(e) => set("session_timeout_hours", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Automatic logout after inactivity.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Lockout Window (minutes)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={val("lockout_window_minutes")}
                  onChange={(e) => set("lockout_window_minutes", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Time window for counting failed login attempts.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Max Failed Login Attempts</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={val("max_failed_login_attempts")}
                  onChange={(e) => set("max_failed_login_attempts", e.target.value)}
                  className="h-9 text-[12px]"
                />
                <FieldHelp>Account locks after this many failures.</FieldHelp>
              </div>
              <div>
                <FieldLabel>Recommended</FieldLabel>
                <div className="h-[38px] flex items-center">
                  {securityBaselineMet ? (
                    <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#E8F6EE] text-[#1F7A45]">
                      Security baseline met
                    </span>
                  ) : (
                    <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D]">
                      Complete security fields
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right stack — Notifications (template) + Configuration Health */}
        <div className="flex flex-col gap-3.5 min-w-0">
          {/*
            IMPLEMENTED: Notifications UI matching mock (System Emails, Manager Digest).
            REMAINING: Persist toggles to system_settings and connect email/digest delivery.
            Office Geofence map preview from the mock is intentionally omitted.
          */}
          <section className="bg-white border border-black/[0.075] rounded-[13px] p-[17px]">
            <SectionHead
              icon={Bell}
              title="Notifications"
              sub="Default system communication preferences."
            />
            <div>
              <div className="flex items-center justify-between gap-3.5 py-[11px] border-b border-black/[0.055]">
                <div>
                  <div className="text-[10px] font-semibold text-[#17171A]">System Emails</div>
                  <div className="text-[8.3px] text-[#96969D] mt-0.5 leading-snug">
                    Send account, leave and operational notices by email.
                  </div>
                </div>
                <SettingsToggle
                  on={systemEmailsOn}
                  aria-label="System emails"
                  onClick={() => setSystemEmailsOn((v) => !v)}
                />
              </div>
              <div className="flex items-center justify-between gap-3.5 py-[11px]">
                <div>
                  <div className="text-[10px] font-semibold text-[#17171A]">Manager Digest</div>
                  <div className="text-[8.3px] text-[#96969D] mt-0.5 leading-snug">
                    Send managers a summary of missed logs and attendance exceptions.
                  </div>
                </div>
                <SettingsToggle
                  on={managerDigestOn}
                  aria-label="Manager digest"
                  onClick={() => setManagerDigestOn((v) => !v)}
                />
              </div>
            </div>
          </section>

          <section className="bg-white border border-black/[0.075] rounded-[13px] p-[17px]">
            <SectionHead
              icon={Check}
              title="Configuration Health"
              sub="Current platform configuration status."
            />
            <div>
              <HealthRow
                title="Geofence"
                copy="Location validation is configured."
                ready={geofenceReady}
              />
              <HealthRow
                title="Security"
                copy="Session and lockout controls are set."
                ready={securityBaselineMet}
              />
              <HealthRow
                title="Notifications"
                copy="Email delivery defaults are active."
                ready={notificationsReady}
                last
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function defaultsFor(key: string): string {
  switch (key) {
    case "app_name":
      return "Ziel Logs";
    case "onsite_latitude":
      return "33.712417";
    case "onsite_longitude":
      return "73.039444";
    case "onsite_radius_meters":
      return "300";
    case "geofence_enabled":
      return "true";
    case "session_timeout_hours":
      return "8";
    case "lockout_window_minutes":
      return "15";
    case "max_failed_login_attempts":
      return "5";
    default:
      return "";
  }
}

function HealthRow({
  title,
  copy,
  ready,
  last,
}: {
  title: string;
  copy: string;
  ready: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3.5 py-[11px]",
        !last && "border-b border-black/[0.055]"
      )}
    >
      <div>
        <div className="text-[10px] font-semibold text-[#17171A]">{title}</div>
        <div className="text-[8.3px] text-[#96969D] mt-0.5 leading-snug">{copy}</div>
      </div>
      <span
        className={cn(
          "inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap",
          ready ? "bg-[#E8F6EE] text-[#1F7A45]" : "bg-[#FDF3E3] text-[#A9720B]"
        )}
      >
        {ready ? "Ready" : "Needs setup"}
      </span>
    </div>
  );
}
