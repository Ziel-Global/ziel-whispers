import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "@/components/employees/AvatarUpload";
import { PasswordInput } from "@/components/ui/password-input";

const SUPABASE_URL = "https://goutpygixoxkgbrfmkey.supabase.co";

const profileSchema = z.object({
  phone: z.string().optional().refine((v) => !v || /^03\d{9}$/.test(v), "Please enter a valid Pakistani phone number (03XXXXXXXXX)"),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "Min 8 characters").regex(/[0-9]/, "Must contain a number").regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, { message: "Passwords don't match", path: ["confirm_password"] });

export default function MyProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const { data: employee } = useQuery({
    queryKey: ["employee", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Sync phone from employee data
  useState(() => {
    if (employee?.phone) setPhone(employee.phone);
  });

  const { data: pwFormState, } = useQuery({ queryKey: ["_noop"], queryFn: () => null, enabled: false });

  const avatarUrl = employee?.avatar_url ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${employee.avatar_url}` : undefined;

  const onSave = async () => {
    if (!employee) return;
    // Validate phone
    const parsed = profileSchema.safeParse({ phone });
    if (!parsed.success) {
      setPhoneError(parsed.error.errors[0]?.message || "Invalid phone");
      return;
    }
    setPhoneError("");
    setSaving(true);
    try {
      // Employee can ONLY update phone
      const { error } = await supabase.from("users").update({
        phone: phone || null,
      }).eq("id", employee.id);
      if (error) throw error;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${employee.id}/avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        await supabase.from("users").update({ avatar_url: path }).eq("id", employee.id);
      }
      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "user.profile_updated", target_entity: "users", target_id: employee.id });
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["employee", user?.id] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const onChangePassword = async () => {
    const parsed = passwordSchema.safeParse({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach(e => { errs[e.path[0] as string] = e.message; });
      setPwErrors(errs);
      return;
    }
    setPwErrors({});
    setChangingPw(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: employee!.email, password: currentPassword });
      if (signInError) { toast.error("Current password is incorrect"); setChangingPw(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.from("users").update({ must_change_password: false }).eq("id", employee!.id);
      await supabase.from("audit_logs").insert({ actor_id: user!.id, action: "user.password_changed", target_entity: "users", target_id: employee!.id });
      toast.success("Password changed successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) { toast.error(err.message); }
    finally { setChangingPw(false); }
  };

  if (!employee) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;

  // Set phone from employee on first load
  if (phone === "" && employee.phone) {
    setPhone(employee.phone);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">{employee.designation} · {employee.department}</p>
      </div>

      <Card className="p-6 space-y-6">
        <AvatarUpload currentUrl={avatarUrl} onFileChange={setAvatarFile} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label className="text-muted-foreground text-xs">Full Name</Label><p className="font-medium">{employee.full_name}</p></div>
          <div><Label className="text-muted-foreground text-xs">Email</Label><p className="font-medium">{employee.email}</p></div>
          <div><Label className="text-muted-foreground text-xs">Department</Label><p className="font-medium">{employee.department}</p></div>
          <div><Label className="text-muted-foreground text-xs">Designation</Label><p className="font-medium">{employee.designation}</p></div>
          <div><Label className="text-muted-foreground text-xs">Employment Type</Label><p className="font-medium">{employee.employment_type}</p></div>
          <div><Label className="text-muted-foreground text-xs">Join Date</Label><p className="font-medium">{employee.join_date}</p></div>
          <div><Label className="text-muted-foreground text-xs">Role</Label><p className="font-medium capitalize">{employee.role}</p></div>
          <div><Label className="text-muted-foreground text-xs">Shift Start</Label><p className="font-medium">{employee.shift_start}</p></div>
          <div><Label className="text-muted-foreground text-xs">Shift End</Label><p className="font-medium">{employee.shift_end}</p></div>
        </div>
        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">Contact your admin to change name, email, department, shift timing, or other details.</p>
        <Separator />
        <div className="space-y-4">
          <h3 className="font-semibold">Editable Fields</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" />
              {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving} className="rounded-button">{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Change Password</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">Current Password <span className="text-destructive">*</span></Label>
            <PasswordInput id="current_password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            {pwErrors.current_password && <p className="text-sm text-destructive">{pwErrors.current_password}</p>}
          </div>
          <div />
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password <span className="text-destructive">*</span></Label>
            <PasswordInput id="new_password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} showStrength />
            {pwErrors.new_password && <p className="text-sm text-destructive">{pwErrors.new_password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm Password <span className="text-destructive">*</span></Label>
            <PasswordInput id="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {pwErrors.confirm_password && <p className="text-sm text-destructive">{pwErrors.confirm_password}</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onChangePassword} disabled={changingPw} variant="outline">{changingPw ? "Changing…" : "Change Password"}</Button>
        </div>
      </Card>
    </div>
  );
}
