import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkSettings, getPKTDateString } from "@/hooks/useWorkSettings";
import { toast } from "sonner";
import { format } from "date-fns";
import { getAvatarUrl, MISC_PROJECT_ID } from "@/lib/utils";

export const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];
export const EMP_TYPES = ["full-time", "part-time", "contract"];
export const ROLES = ["admin", "manager", "employee"];
export const REMINDER_OPTIONS = [15, 30, 60];

export const adminSchema = z.object({
  full_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional().refine((v) => !v || /^03\d{9}$/.test(v), "Please enter a valid Pakistani phone number (03XXXXXXXXX)"),
  designation: z.string().min(1).max(100),
  department: z.string().min(1),
  join_date: z.string().min(1),
  employment_type: z.string().min(1),
  role: z.string().min(1),
  shift_start: z.string(),
  shift_end: z.string(),
  reminder_offset_minutes: z.number(),
  is_night_shift: z.boolean(),
  working_days: z.number().min(5).max(6),
  overtime_enabled: z.boolean(),
});

export const clientEditSchema = z.object({
  full_name: z.string().min(3, "Name must be between 3 and 60 characters").max(60).regex(/^[a-zA-Z\s.'-]+$/, "Name must contain only letters"),
  email: z.string().email("Please enter a valid email address").refine((v) => !/\s/.test(v), "No spaces allowed"),
  project_ids: z.array(z.string()).optional(),
});

export function useEmployeeProfileData(id: string | undefined) {
  const { profile: myProfile } = useAuth();
  const queryClient = useQueryClient();
  const { expectedDailyHours } = useWorkSettings();

  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [togglingOversight, setTogglingOversight] = useState(false);
  const [emailWarningOpen, setEmailWarningOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [bulkDeleteLogOpen, setBulkDeleteLogOpen] = useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminPwError, setAdminPwError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  // Work Logs filters
  const [logDateFilter, setLogDateFilter] = useState("");
  const [logProjectFilter, setLogProjectFilter] = useState("all");

  // Logged Hours tab state
  const [loggedHoursMonth, setLoggedHoursMonth] = useState(() => getPKTDateString().slice(0, 7));

  // Feature 1 — Log Edit Days
  const [logEditDays, setLogEditDays] = useState<string>("");
  const [savingLogEditDays, setSavingLogEditDays] = useState(false);

  // Feature 2 — Access Controls
  const [employeeRemoteAccess, setEmployeeRemoteAccess] = useState(false);
  const [employeeRemoteAccessFrom, setEmployeeRemoteAccessFrom] = useState("");
  const [employeeRemoteAccessTo, setEmployeeRemoteAccessTo] = useState("");
  const [employeeIsOnLeave, setEmployeeIsOnLeave] = useState(false);
  const [employeeIsOnLeaveFrom, setEmployeeIsOnLeaveFrom] = useState("");
  const [employeeIsOnLeaveTo, setEmployeeIsOnLeaveTo] = useState("");
  const [savingAccessControls, setSavingAccessControls] = useState(false);

  const isAdmin = myProfile?.role === "admin";
  const isOwnProfile = myProfile?.id === id;

  const { data: employee, isLoading, error: employeeError } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Work Logs for this employee
  const { data: workLogs = [] } = useQuery({
    queryKey: ["employee-work-logs", id, logDateFilter, logProjectFilter],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", id!)
        .eq("status", "submitted")
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (logDateFilter) query = query.eq("log_date", logDateFilter);
      if (logProjectFilter === MISC_PROJECT_ID) {
        query = query.is("project_id", null);
      } else if (logProjectFilter !== "all") {
        query = query.eq("project_id", logProjectFilter);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!id && isAdmin,
  });

  // Projects for display and filter
  const { data: employeeProjects = [] } = useQuery({
    queryKey: ["employee-projects-tab", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("assigned_at, projects(id, name, status), project_roles(name)")
        .eq("user_id", id!)
        .is("removed_at", null);
      return (data || []).map((m: any) => ({
        ...m.projects,
        project_role: m.project_roles?.name,
        assigned_at: m.assigned_at
      })).filter(p => p.id);
    },
    enabled: !!id && isAdmin,
  });

  const totalLoggedHours = useMemo(() => workLogs.reduce((s: number, l: any) => s + Number(l.hours), 0), [workLogs]);

  // Global settings for shift comparison
  const { data: globalSettings } = useQuery({
    queryKey: ["system-settings-global"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value").in("key", ["default_shift_start", "default_shift_end"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  // Client Member edit: available projects
  const { data: clientProjects = [] } = useQuery({
    queryKey: ["projects-list-for-client-member"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["active", "on_hold"])
        .order("name");
      return data || [];
    },
    enabled: !!employee && employee.role === "client member",
  });

  // Client Member edit: current project memberships
  const { data: clientProjectIds = [] } = useQuery({
    queryKey: ["client-member-projects", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", id!)
        .is("removed_at", null);
      return (data || []).map((m: any) => m.project_id as string);
    },
    enabled: !!id && !!employee && employee.role === "client member",
  });

  const isClientMember = employee?.role === "client member";

  const clientEditForm = useForm<z.infer<typeof clientEditSchema>>({
    resolver: zodResolver(clientEditSchema),
    defaultValues: { full_name: "", email: "", project_ids: [] },
  });

  useEffect(() => {
    if (employee && isClientMember) {
      clientEditForm.reset({
        full_name: employee.full_name || "",
        email: employee.email || "",
        project_ids: clientProjectIds || [],
      });
    }
  }, [employee, clientProjectIds, isClientMember, clientEditForm]);

  // Logged Hours tab — month boundaries
  const [lhYear, lhMonth] = loggedHoursMonth.split("-").map(Number);
  const monthStart = `${loggedHoursMonth}-01`;
  const monthEnd = `${loggedHoursMonth}-${String(new Date(lhYear, lhMonth, 0).getDate()).padStart(2, "0")}`;

  const { data: monthlyLogs = [] } = useQuery({
    queryKey: ["employee-monthly-logs", id, monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("hours, is_overtime")
        .eq("user_id", id!)
        .eq("status", "submitted")
        .gte("log_date", monthStart)
        .lte("log_date", monthEnd);
      return data || [];
    },
    enabled: !!id && isAdmin,
  });

  const { data: monthlyLeaves = [] } = useQuery({
    queryKey: ["employee-monthly-leaves", id, monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("start_date, end_date")
        .eq("user_id", id!)
        .eq("status", "approved")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart);
      return data || [];
    },
    enabled: !!id && isAdmin,
  });

  const todayPKT = getPKTDateString();
  const { data: todayLeave = [] } = useQuery({
    queryKey: ["employee-today-leave", id, todayPKT],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("id")
        .eq("user_id", id!)
        .eq("status", "approved")
        .lte("start_date", todayPKT)
        .gte("end_date", todayPKT);
      return data || [];
    },
    enabled: !!id,
  });
  const hasAdminLeave = !!(
    employee?.is_on_leave &&
    (!employee.is_on_leave_from || employee.is_on_leave_from <= todayPKT) &&
    (!employee.is_on_leave_to || employee.is_on_leave_to >= todayPKT)
  );
  const isOnLeaveToday = todayLeave.length > 0 || hasAdminLeave;

  const monthlyStats = useMemo(() => {
    const wd = employee?.working_days || 5;
    const otEnabled = employee?.overtime_enabled ?? false;

    const rangeStart = new Date(monthStart + "T00:00:00");
    const rangeEnd = new Date(monthEnd + "T00:00:00");

    const leaveDates = new Set<string>();
    for (const leave of monthlyLeaves) {
      const ls = new Date(leave.start_date + "T00:00:00");
      const le = new Date(leave.end_date + "T00:00:00");
      const d = new Date(Math.max(ls.getTime(), rangeStart.getTime()));
      const dEnd = new Date(Math.min(le.getTime(), rangeEnd.getTime()));
      while (d <= dEnd) {
        leaveDates.add(format(d, "yyyy-MM-dd"));
        d.setDate(d.getDate() + 1);
      }
    }

    let workingDayCount = 0;
    const cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      const day = cur.getDay();
      const isWeekend = day === 0 || (wd === 5 && day === 6);
      if (!isWeekend && !leaveDates.has(format(cur, "yyyy-MM-dd"))) workingDayCount++;
      cur.setDate(cur.getDate() + 1);
    }

    const expected = workingDayCount * expectedDailyHours;
    let logged = 0;
    let overtime = 0;
    for (const log of monthlyLogs) {
      const h = Number(log.hours);
      logged += h;
      if (log.is_overtime) overtime += h;
    }

    return {
      expectedHours: expected,
      loggedHours: logged,
      unloggedHours: Math.max(0, expected - logged),
      overtimeHours: overtime,
      overtimeEnabled: otEnabled,
    };
  }, [monthStart, monthEnd, monthlyLogs, monthlyLeaves, employee, expectedDailyHours]);

  const form = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      full_name: employee?.full_name || "",
      email: employee?.email || "",
      phone: employee?.phone || "",
      designation: employee?.designation || "",
      department: employee?.department || "",
      join_date: employee?.join_date || "",
      employment_type: employee?.employment_type || "",
      role: employee?.role || "",
      shift_start: employee?.shift_start || "09:00",
      shift_end: employee?.shift_end || "17:00",
      reminder_offset_minutes: employee?.reminder_offset_minutes || 15,
      is_night_shift: employee?.is_night_shift ?? false,
      working_days: employee?.working_days || 5,
      overtime_enabled: employee?.overtime_enabled ?? false,
    },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        full_name: employee.full_name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        designation: employee.designation || "",
        department: employee.department || "",
        join_date: employee.join_date || "",
        employment_type: employee.employment_type || "",
        role: employee.role || "",
        shift_start: employee.shift_start || "09:00",
        shift_end: employee.shift_end || "17:00",
        reminder_offset_minutes: employee.reminder_offset_minutes || 15,
        is_night_shift: employee.is_night_shift ?? false,
        working_days: employee.working_days || 5,
        overtime_enabled: employee.overtime_enabled ?? false,
      });
      setLogEditDays(employee.log_edit_days ?? "");
      setEmployeeRemoteAccess(employee.remote_access ?? false);
      setEmployeeRemoteAccessFrom(employee.remote_access_from ?? "");
      setEmployeeRemoteAccessTo(employee.remote_access_to ?? "");
      setEmployeeIsOnLeave(employee.is_on_leave ?? isOnLeaveToday);
      setEmployeeIsOnLeaveFrom(employee.is_on_leave_from ?? "");
      setEmployeeIsOnLeaveTo(employee.is_on_leave_to ?? "");
    }
  }, [employee, form, isOnLeaveToday]);

  const avatarUrl = getAvatarUrl(employee?.avatar_url);
  const canEdit = isAdmin;

  const saveProfile = async (data: z.infer<typeof adminSchema>) => {
    if (!employee) return;
    setSaving(true);
    try {
      const globalShiftStart = globalSettings?.default_shift_start;
      const globalShiftEnd = globalSettings?.default_shift_end;
      if (!globalShiftStart || !globalShiftEnd) {
        toast.error("Default shift times are not configured. Please set them in Settings first.");
        setSaving(false);
        return;
      }
      const hasCustomShift = data.shift_start !== globalShiftStart || data.shift_end !== globalShiftEnd;

      const { error } = await supabase.from("users").update({
        full_name: data.full_name,
        phone: data.phone || null,
        designation: data.designation,
        department: data.department,
        join_date: data.join_date,
        employment_type: data.employment_type,
        role: data.role,
        shift_start: data.shift_start,
        shift_end: data.shift_end,
        reminder_offset_minutes: data.reminder_offset_minutes,
        is_night_shift: data.is_night_shift,
        working_days: data.working_days,
        overtime_enabled: data.overtime_enabled,
        has_custom_shift: hasCustomShift,
      } as any).eq("id", employee.id);

      if (error) throw error;

      if (avatarFile && isOwnProfile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${employee.id}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        await supabase.from("users").update({ avatar_url: path }).eq("id", employee.id);
      }

      await supabase.from("audit_logs").insert({
        actor_id: myProfile?.id,
        action: "user.updated",
        target_entity: "users",
        target_id: employee.id,
      });

      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof adminSchema>) => {
    if (!employee) return;
    if (data.email !== employee.email) {
      setPendingEmail(data.email);
      setEmailWarningOpen(true);
      return;
    }
    await saveProfile(data);
  };

  const clientEditOnSubmit = async (data: z.infer<typeof clientEditSchema>) => {
    if (!employee) return;
    setSaving(true);
    try {
      if (data.email !== employee.email) {
        setPendingEmail(data.email);
        setEmailWarningOpen(true);
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("users").update({
        full_name: data.full_name,
        email: data.email,
      } as any).eq("id", employee.id);
      if (error) throw error;

      if (avatarFile && isOwnProfile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${employee.id}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        await supabase.from("users").update({ avatar_url: path }).eq("id", employee.id);
      }

      const currentIds = clientProjectIds || [];
      const newIds = data.project_ids || [];

      const toRemove = currentIds.filter((pId) => !newIds.includes(pId));
      const toAdd = newIds.filter((pId) => !currentIds.includes(pId));

      if (toRemove.length > 0) {
        await supabase
          .from("project_members")
          .update({ removed_at: new Date().toISOString() } as any)
          .eq("user_id", employee.id)
          .in("project_id", toRemove)
          .is("removed_at", null);
      }

      for (const newProjectId of toAdd) {
        let roleId: string | null = null;
        const { data: existingRole } = await supabase
          .from("project_roles")
          .select("id")
          .eq("project_id", newProjectId)
          .eq("name", "Client")
          .maybeSingle();

        if (existingRole) {
          roleId = existingRole.id;
        } else {
          const { data: newRole } = await supabase
            .from("project_roles")
            .insert({ project_id: newProjectId, name: "Client" })
            .select("id")
            .single();
          roleId = newRole?.id || null;
        }

        await supabase.from("project_members").insert({
          project_id: newProjectId,
          user_id: employee.id,
          project_role_id: roleId,
        });
      }

      await supabase.from("audit_logs").insert({
        actor_id: myProfile?.id,
        action: "user.updated",
        target_entity: "users",
        target_id: employee.id,
      });

      toast.success("Client Member profile updated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["client-member-projects", id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmEmailChange = async () => {
    setEmailWarningOpen(false);
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "update_email", user_id: employee!.id, new_email: pendingEmail },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to update email");

      const formData = form.getValues();
      formData.email = pendingEmail;
      await saveProfile(formData);
    } catch (err: any) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!employee) return;
    setDeactivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "deactivate", user_id: employee.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to deactivate employee");
      toast.success("Employee deactivated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    if (!employee) return;
    setDeactivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "reactivate", user_id: employee.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to reactivate employee");
      toast.success("Employee reactivated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const handleOversightToggle = async () => {
    if (!employee) return;
    const newValue = !employee.is_oversight;
    setTogglingOversight(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke("manage-user", {
        body: { action: newValue ? "oversight_on" : "oversight_off", user_id: employee.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      const res = result as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed to update oversight status");
      toast.success(newValue ? "Employee marked as oversight" : "Oversight removed");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTogglingOversight(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    const { error } = await supabase.from("daily_logs").delete().eq("id", logId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({ actor_id: myProfile?.id, action: "log.deleted", target_entity: "daily_logs", target_id: logId });
    toast.success("Log entry deleted.");
    setDeleteLogId(null);
    queryClient.invalidateQueries({ queryKey: ["employee-work-logs"] });
    queryClient.invalidateQueries({ queryKey: ["employee-monthly-logs"] });
  };

  const handleBulkDeleteLogs = async () => {
    const ids = Array.from(selectedLogIds);
    if (!ids.length) return;
    const { error } = await supabase.from("daily_logs").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    for (const logId of ids) {
      await supabase.from("audit_logs").insert({ actor_id: myProfile?.id, action: "log.deleted", target_entity: "daily_logs", target_id: logId });
    }
    toast.success(`${ids.length} log${ids.length > 1 ? "s" : ""} deleted`);
    setSelectedLogIds(new Set());
    setBulkDeleteLogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["employee-work-logs"] });
    queryClient.invalidateQueries({ queryKey: ["employee-monthly-logs"] });
  };

  const handleSaveLogEditDays = async () => {
    if (!employee) return;
    setSavingLogEditDays(true);
    try {
      const { error } = await supabase.from("users").update({
        log_edit_days: logEditDays === "" ? null : parseInt(logEditDays, 10),
      } as any).eq("id", employee.id);
      if (error) throw error;
      toast.success("Log edit days updated");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingLogEditDays(false);
    }
  };

  const handleSaveAccessControls = async () => {
    if (!employee) return;

    if (employeeRemoteAccess && (!employeeRemoteAccessFrom || !employeeRemoteAccessTo)) {
      toast.error("Please select both From and To dates for Remote Access.");
      return;
    }
    if (employeeIsOnLeave && (!employeeIsOnLeaveFrom || !employeeIsOnLeaveTo)) {
      toast.error("Please select both From and To dates for Mark as On Leave.");
      return;
    }

    setSavingAccessControls(true);
    try {
      const { error } = await supabase.from("users").update({
        remote_access: employeeRemoteAccess,
        remote_access_from: employeeRemoteAccess ? employeeRemoteAccessFrom : null,
        remote_access_to: employeeRemoteAccess ? employeeRemoteAccessTo : null,
        remote_access_bulk: null,
        is_on_leave: employeeIsOnLeave,
        is_on_leave_from: employeeIsOnLeave ? employeeIsOnLeaveFrom : null,
        is_on_leave_to: employeeIsOnLeave ? employeeIsOnLeaveTo : null,
      } as any).eq("id", employee.id);
      if (error) throw error;

      if (employeeIsOnLeave && employeeIsOnLeaveFrom && employeeIsOnLeaveTo) {
        const startDateObj = new Date(employeeIsOnLeaveFrom + "T00:00:00");
        const endDateObj = new Date(employeeIsOnLeaveTo + "T00:00:00");
        let count = 0;
        const cur = new Date(startDateObj);
        const wd = employee.working_days || 5;
        while (cur <= endDateObj) {
          const d = cur.getDay();
          if (wd === 5 ? (d !== 0 && d !== 6) : (d !== 0)) count++;
          cur.setDate(cur.getDate() + 1);
        }
        const daysCount = Math.max(1, count);

        const { data: defaultType } = await supabase.from("leave_types").select("id").limit(1).maybeSingle();
        const { data: existingAdminReq } = await supabase
          .from("leave_requests")
          .select("id")
          .eq("user_id", employee.id)
          .eq("reason", "Admin Granted Leave (Access Controls)")
          .maybeSingle();

        if (existingAdminReq) {
          await supabase.from("leave_requests").update({
            start_date: employeeIsOnLeaveFrom,
            end_date: employeeIsOnLeaveTo,
            days_count: daysCount,
            status: "approved",
            reviewed_by: myProfile?.id || null,
            reviewed_at: new Date().toISOString(),
          }).eq("id", existingAdminReq.id);
        } else {
          await supabase.from("leave_requests").insert({
            user_id: employee.id,
            leave_type_id: defaultType?.id || null,
            start_date: employeeIsOnLeaveFrom,
            end_date: employeeIsOnLeaveTo,
            days_count: daysCount,
            status: "approved",
            reason: "Admin Granted Leave (Access Controls)",
            reviewed_by: myProfile?.id || null,
            reviewed_at: new Date().toISOString(),
          });
        }
      } else {
        await supabase
          .from("leave_requests")
          .delete()
          .eq("user_id", employee.id)
          .eq("reason", "Admin Granted Leave (Access Controls)");
      }

      toast.success("Access controls updated and leave synced");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-used-leave-days"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-team-today"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAccessControls(false);
    }
  };

  const exportWorkLogs = () => {
    const header = "Date,Project,Category,Hours,Description,Submitted At\n";
    const rows = workLogs.map((l: any) =>
      `"${l.log_date}","${l.projects?.name || ""}","${l.category}",${l.hours},"${l.description?.replace(/"/g, '""')}","${format(new Date(l.submitted_at), "h:mm a")}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `work-logs-${employee?.full_name?.replace(/\s+/g, "-")}.csv`;
    a.click();
  };

  const handleUpdatePassword = async () => {
    setAdminPwError("");
    if (adminNewPassword.length < 8) { setAdminPwError("Password must be at least 8 characters"); return; }
    if (!/[0-9]/.test(adminNewPassword)) { setAdminPwError("Password must contain a number"); return; }
    if (!/[^a-zA-Z0-9]/.test(adminNewPassword)) { setAdminPwError("Password must contain a special character"); return; }
    if (adminNewPassword !== adminConfirmPassword) { setAdminPwError("Passwords do not match"); return; }
    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "set_password", user_id: id, new_password: adminNewPassword },
      });
      if (error) {
        toast.error(error.message || "Failed to set password");
      } else if (!(data as any)?.ok) {
        toast.error((data as any)?.error || "Failed to set password");
      } else {
        toast.success("Password updated successfully");
        setAdminNewPassword("");
        setAdminConfirmPassword("");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSettingPassword(false);
    }
  };

  return {
    id,
    myProfile,
    isAdmin,
    isOwnProfile,
    isClientMember,
    employee,
    isLoading,
    employeeError,
    workLogs,
    employeeProjects,
    totalLoggedHours,
    clientProjects,
    clientProjectIds,
    clientEditForm,
    clientEditOnSubmit,
    saving,
    avatarUrl,
    setAvatarFile,
    deactivating,
    togglingOversight,
    emailWarningOpen,
    setEmailWarningOpen,
    pendingEmail,
    confirmEmailChange,
    handleDeactivate,
    handleReactivate,
    handleOversightToggle,
    logDateFilter,
    setLogDateFilter,
    logProjectFilter,
    setLogProjectFilter,
    exportWorkLogs,
    deleteLogId,
    setDeleteLogId,
    handleDeleteLog,
    selectedLogIds,
    setSelectedLogIds,
    bulkDeleteLogOpen,
    setBulkDeleteLogOpen,
    handleBulkDeleteLogs,
    loggedHoursMonth,
    setLoggedHoursMonth,
    monthStart,
    monthlyStats,
    logEditDays,
    setLogEditDays,
    savingLogEditDays,
    handleSaveLogEditDays,
    employeeRemoteAccess,
    setEmployeeRemoteAccess,
    employeeRemoteAccessFrom,
    setEmployeeRemoteAccessFrom,
    employeeRemoteAccessTo,
    setEmployeeRemoteAccessTo,
    employeeIsOnLeave,
    setEmployeeIsOnLeave,
    employeeIsOnLeaveFrom,
    setEmployeeIsOnLeaveFrom,
    employeeIsOnLeaveTo,
    setEmployeeIsOnLeaveTo,
    savingAccessControls,
    handleSaveAccessControls,
    form,
    onSubmit,
    canEdit,
    adminNewPassword,
    setAdminNewPassword,
    adminConfirmPassword,
    setAdminConfirmPassword,
    adminPwError,
    settingPassword,
    handleUpdatePassword,
  };
}
