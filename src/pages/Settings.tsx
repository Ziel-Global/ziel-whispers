import { LeaveSettingsSection } from "@/components/settings/LeaveSettingsSection";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <LeaveSettingsSection />
    </div>
  );
}
