/**
 * Admin user-detail — Profile tab body (ud-* layout from zielAdmin mock).
 *
 * IMPLEMENTED (wired):
 *   - KPI row from employment_type, shift, employeeProjects, monthlyStats
 *   - Profile & Employment + Work Schedule forms (react-hook-form → users upsert)
 *   - Employee Snapshot (status/role/department + employee_skills count)
 *   - Night Shift / Overtime toggles bound to form fields
 *
 * FRONTEND TEMPLATE ONLY:
 *   - Account & Activity (last login / last work log / manager / location)
 *   - Recent Admin Changes timeline
 *
 * DEFERRED:
 *   - Page header ud-* restyle (back / avatar / Oversight / Deactivate)
 *   - Other tab bodies (Skills, Projects, Work Logs, …)
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/employees/AvatarUpload";
import { formatTime12h } from "@/hooks/useWorkSettings";
import { adminSchema, DEPARTMENTS, EMP_TYPES, ROLES, REMINDER_OPTIONS } from "@/hooks/useEmployeeProfileData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-[9px] border-black/10 bg-[#FBFBFA] px-[11px] text-[12.5px] font-medium text-[#3F3F45] focus-visible:bg-white focus-visible:border-[#EB5A1E] focus-visible:ring-[3px] focus-visible:ring-[#EB5A1E]/10";
const selectTriggerClass =
  "h-10 rounded-[9px] border-black/10 bg-[#FBFBFA] px-[11px] text-[12.5px] font-medium text-[#3F3F45] focus:ring-[3px] focus:ring-[#EB5A1E]/10 data-[placeholder]:text-[#3F3F45]";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] font-bold text-[#39393F] mb-[7px]">{children}</div>;
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-[#9A9AA0] leading-normal mt-1.5">{children}</p>;
}

function UdToggle({
  on,
  disabled,
  onClick,
  "aria-label": ariaLabel,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative w-[38px] h-[22px] rounded-[20px] shrink-0 transition-colors disabled:opacity-50",
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

function empTypeLabel(t: string) {
  if (t === "full-time") return "Full-Time";
  if (t === "part-time") return "Part-Time";
  if (t === "contract") return "Contract";
  return t;
}

function roleLabel(r: string) {
  if (r === "admin") return "Administrator";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function statusLabel(s: string) {
  return (s || "active").charAt(0).toUpperCase() + (s || "active").slice(1);
}

export interface EmployeeProfileTabProps {
  employee: any;
  avatarUrl: string;
  isOwnProfile: boolean;
  canEdit: boolean;
  saving: boolean;
  setAvatarFile: (file: File | null) => void;
  form: UseFormReturn<z.infer<typeof adminSchema>>;
  onSubmit: (data: z.infer<typeof adminSchema>) => Promise<void>;
  employeeProjects?: any[];
  monthlyStats?: {
    expectedHours: number;
    loggedHours: number;
    unloggedHours: number;
    overtimeHours: number;
    overtimeEnabled: boolean;
  };
}

export function EmployeeProfileTab({
  employee,
  avatarUrl,
  isOwnProfile,
  canEdit,
  saving,
  setAvatarFile,
  form,
  onSubmit,
  employeeProjects = [],
  monthlyStats,
}: EmployeeProfileTabProps) {
  const { data: globalShiftDefaults } = useQuery({
    queryKey: ["system-settings-global"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["default_shift_start", "default_shift_end"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 30000,
  });
  const defaultShiftStart = globalShiftDefaults?.default_shift_start || "";
  const defaultShiftEnd = globalShiftDefaults?.default_shift_end || "";

  const { data: skillsCount = 0 } = useQuery({
    queryKey: ["employee-skills-count", employee?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_skills" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", employee.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!employee?.id,
  });

  const watchEmpType = form.watch("employment_type");
  const watchShiftStart = form.watch("shift_start");
  const watchShiftEnd = form.watch("shift_end");
  const watchJoin = form.watch("join_date");
  const watchDept = form.watch("department");
  const watchRole = form.watch("role");

  const activeProjects = useMemo(
    () => employeeProjects.filter((p) => p.status === "active" || !p.status),
    [employeeProjects]
  );

  const loggedPct = useMemo(() => {
    if (!monthlyStats || monthlyStats.expectedHours <= 0) return 0;
    return Math.round((monthlyStats.loggedHours / monthlyStats.expectedHours) * 100);
  }, [monthlyStats]);

  const joinLabel = watchJoin
    ? format(new Date(watchJoin + "T00:00:00"), "dd/MM/yyyy")
    : employee?.join_date
      ? format(new Date(employee.join_date + "T00:00:00"), "dd/MM/yyyy")
      : "—";

  const status = employee?.status || "active";
  const statusPillClass =
    status === "active"
      ? "bg-[#DFF6E4] text-[#1B8A46]"
      : status === "pending"
        ? "bg-[#FDF3E3] text-[#A9720B]"
        : "bg-[#F1F1F3] text-[#66666D]";

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Employment</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {empTypeLabel(watchEmpType || employee?.employment_type || "full-time")}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">Employee since {joinLabel}</div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Current Shift</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {formatTime12h(watchShiftStart)}–{formatTime12h(watchShiftEnd)}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {employee?.has_custom_shift ? "Employee-specific override" : "Using global shift defaults"}
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Active Projects</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {activeProjects.length}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {employeeProjects.length} total assignment{employeeProjects.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Logged This Month</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {Math.round(monthlyStats?.loggedHours ?? 0)}h
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {loggedPct}% of {Math.round(monthlyStats?.expectedHours ?? 0)}h expected
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start w-full min-w-0">
        {/* Left: forms */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 min-w-0">
            {isOwnProfile ? (
              <div className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
                <AvatarUpload currentUrl={avatarUrl} onFileChange={setAvatarFile} />
              </div>
            ) : null}

            {/* Profile & Employment */}
            <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
              <div className="flex items-start justify-between gap-3.5 mb-[17px]">
                <div>
                  <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Profile & Employment</div>
                  <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
                    Identity, contact and employment information.
                  </div>
                </div>
                <span className={cn("text-[11px] font-bold px-[9px] py-[3px] rounded-[20px] whitespace-nowrap", statusPillClass)}>
                  {statusLabel(status)} employee
                </span>
              </div>

              {!isOwnProfile && (
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-11 w-11 rounded-xl">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="rounded-xl bg-[#DFF6E4] text-[#1B8A46] font-extrabold text-sm">
                      {employee?.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Full Name</FieldLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Email</FieldLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Phone</FieldLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Designation</FieldLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Department</FieldLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="join_date"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Join Date</FieldLabel>
                      <FormControl>
                        <Input {...field} type="date" disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employment_type"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Employment Type</FieldLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue>
                              <span>{empTypeLabel(field.value)}</span>
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EMP_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {empTypeLabel(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Role</FieldLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue>
                              <span>{roleLabel(field.value)}</span>
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {roleLabel(r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {canEdit ? (
                <div className="flex justify-end mt-[18px]">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-[38px] rounded-[9px] px-3.5 bg-[#EB5A1E] hover:bg-[#C64715] border-[#EB5A1E] text-white text-[12px] font-semibold"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              ) : !isOwnProfile ? (
                <p className="text-[11.5px] text-[#8B8B92] bg-[#F6F5F3] p-3 rounded-[9px] mt-4">
                  Contact your admin to change profile details.
                </p>
              ) : null}
            </section>

            {/* Work Schedule */}
            <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
              <div className="flex items-start justify-between gap-3.5 mb-[17px]">
                <div>
                  <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Work Schedule</div>
                  <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
                    Employee-specific schedule and logging behaviour.
                  </div>
                </div>
                <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap">
                  {employee?.has_custom_shift ? "Overrides global shift" : "Global shift defaults"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                <FormField
                  control={form.control}
                  name="shift_start"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Shift Start</FieldLabel>
                      <FormControl>
                        <Input {...field} type="time" disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FieldHelp>Global default: {formatTime12h(defaultShiftStart)}</FieldHelp>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shift_end"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Shift End</FieldLabel>
                      <FormControl>
                        <Input {...field} type="time" disabled={!canEdit} className={inputClass} />
                      </FormControl>
                      <FieldHelp>Global default: {formatTime12h(defaultShiftEnd)}</FieldHelp>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reminder_offset_minutes"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Reminder Offset</FieldLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={String(field.value)}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REMINDER_OPTIONS.map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {m} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="working_days"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Working Days</FieldLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={String(field.value)}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5">5 Days (Mon–Fri)</SelectItem>
                          <SelectItem value="6">6 Days (Mon–Sat)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-2.5">
                <FormField
                  control={form.control}
                  name="is_night_shift"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3.5 py-[11px] border-b border-black/[0.055] space-y-0">
                      <div>
                        <div className="text-[10px] font-semibold text-[#17171A]">Night Shift Employee</div>
                        <div className="text-[8.3px] text-[#96969D] mt-0.5 leading-snug">
                          Skip automatic midnight clock-out for this employee.
                        </div>
                      </div>
                      <UdToggle
                        on={!!field.value}
                        disabled={!canEdit}
                        aria-label="Night shift"
                        onClick={() => canEdit && field.onChange(!field.value)}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="overtime_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3.5 py-[11px] space-y-0">
                      <div>
                        <div className="text-[10px] font-semibold text-[#17171A]">Overtime Enabled</div>
                        <div className="text-[8.3px] text-[#96969D] mt-0.5 leading-snug">
                          Allow hours beyond 8h and weekend work logs.
                        </div>
                      </div>
                      <UdToggle
                        on={!!field.value}
                        disabled={!canEdit}
                        aria-label="Overtime enabled"
                        onClick={() => canEdit && field.onChange(!field.value)}
                      />
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </form>
        </Form>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Employee Snapshot — wired */}
          <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Employee Snapshot</div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Operational summary visible to administrators.
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
                <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Status</div>
                <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">{statusLabel(status)}</div>
              </div>
              <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
                <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Role</div>
                <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">
                  {roleLabel(watchRole || employee?.role || "employee")}
                </div>
              </div>
              <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
                <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Department</div>
                <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">
                  {watchDept || employee?.department || "—"}
                </div>
              </div>
              <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
                <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Skills</div>
                <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">{skillsCount}</div>
              </div>
            </div>
          </section>

          {/*
            IMPLEMENTED: Account & Activity UI matching mock info list.
            REMAINING: Wire last login (auth/session), last work log (daily_logs),
            manager assignment, and location/onsite status from real data sources.
          */}
          <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Account & Activity</div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Useful account context without leaving the profile.
            </div>
            <div className="mt-3.5 flex flex-col">
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
                <span className="text-[11px] text-[#8B8B92]">Last login</span>
                <span className="text-[11.5px] font-semibold text-[#3F3F45]">—</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
                <span className="text-[11px] text-[#8B8B92]">Last work log</span>
                <span className="text-[11.5px] font-semibold text-[#3F3F45]">—</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
                <span className="text-[11px] text-[#8B8B92]">Manager</span>
                <span className="text-[11.5px] font-semibold text-[#3F3F45]">—</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[11px] text-[#8B8B92]">Location</span>
                <span className="text-[11.5px] font-semibold text-[#3F3F45]">—</span>
              </div>
            </div>
          </section>

          {/*
            IMPLEMENTED: Recent Admin Changes timeline UI matching mock.
            REMAINING: Query audit_logs for this user (shift/project/access changes)
            and render real actor + timestamp rows.
          */}
          <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Recent Admin Changes</div>
            <div className="flex flex-col gap-2.5 mt-[13px]">
              <div className="flex gap-[9px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#EB5A1E] mt-[5px] shrink-0" />
                <div>
                  <div className="text-[11.5px] font-semibold text-[#252529]">No recent changes</div>
                  <div className="text-[10px] text-[#9A9AA0] mt-0.5 leading-normal">
                    Admin audit history will appear here once wired.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
