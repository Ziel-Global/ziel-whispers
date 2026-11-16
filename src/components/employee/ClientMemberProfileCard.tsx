import React from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { clientEditSchema, ROLES } from "@/hooks/useEmployeeProfileData";
import { roleLabel, statusLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-[9px] border-black/10 bg-[#FBFBFA] px-[11px] text-[12.5px] font-medium text-[#3F3F45] focus-visible:bg-white focus-visible:border-[#EB5A1E] focus-visible:ring-[3px] focus-visible:ring-[#EB5A1E]/10";
const selectTriggerClass =
  "h-10 rounded-[9px] border-black/10 bg-[#FBFBFA] px-[11px] text-[12.5px] font-medium text-[#3F3F45] focus:ring-[3px] focus:ring-[#EB5A1E]/10 data-[placeholder]:text-[#3F3F45]";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] font-bold text-[#39393F] mb-[7px]">{children}</div>;
}

export interface ClientMemberProfileCardProps {
  employee: any;
  avatarUrl: string;
  clientProjects: any[];
  clientEditForm: UseFormReturn<z.infer<typeof clientEditSchema>>;
  clientEditOnSubmit: (data: z.infer<typeof clientEditSchema>) => Promise<void>;
  saving: boolean;
  canEdit?: boolean;
  showPasswordCard?: boolean;
  adminNewPassword?: string;
  setAdminNewPassword?: (v: string) => void;
  adminConfirmPassword?: string;
  setAdminConfirmPassword?: (v: string) => void;
  adminPwError?: string;
  settingPassword?: boolean;
  handleUpdatePassword?: () => Promise<void>;
}

export function ClientMemberProfileCard({
  employee,
  avatarUrl,
  clientProjects,
  clientEditForm,
  clientEditOnSubmit,
  saving,
  canEdit = true,
  showPasswordCard = false,
  adminNewPassword = "",
  setAdminNewPassword,
  adminConfirmPassword = "",
  setAdminConfirmPassword,
  adminPwError = "",
  settingPassword = false,
  handleUpdatePassword,
}: ClientMemberProfileCardProps) {
  const watchJoin = clientEditForm.watch("join_date");
  const watchRole = clientEditForm.watch("role");
  const watchProjects = clientEditForm.watch("project_ids");

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
    <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start w-full min-w-0">
      {/* Left column: Profile + Assign to Projects + Security & Password */}
      <div className="flex flex-col gap-4 min-w-0">
        <Form {...clientEditForm}>
          <form onSubmit={clientEditForm.handleSubmit(clientEditOnSubmit)} className="flex flex-col gap-4 min-w-0">
            {/* Profile Details Card */}
            <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
              <div className="flex items-start justify-between gap-3.5 mb-[17px]">
                <div>
                  <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Profile Details</div>
                  <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
                    Identity, contact and account information.
                  </div>
                </div>
                <span className={cn("text-[11px] font-bold px-[9px] py-[3px] rounded-[20px] whitespace-nowrap", statusPillClass)}>
                  {statusLabel(status)} client member
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-11 w-11 rounded-xl">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="rounded-xl bg-[#DFF6E4] text-[#1B8A46] font-extrabold text-sm">
                    {employee?.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                <FormField
                  control={clientEditForm.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Full Name</FieldLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} placeholder="e.g. Sara Ahmed" className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientEditForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Email</FieldLabel>
                      <FormControl>
                        <Input {...field} type="email" disabled={!canEdit} placeholder="member@client-company.com" className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientEditForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="min-w-0 space-y-0">
                      <FieldLabel>Phone</FieldLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} placeholder="03001234567" className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientEditForm.control}
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
                  control={clientEditForm.control}
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

              {/* Assign to Projects Section */}
              <div className="mt-5 pt-4 border-t border-black/[0.06]">
                <FormField
                  control={clientEditForm.control}
                  name="project_ids"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-[11.5px] font-bold text-[#39393F]">
                            Assign to Projects <span className="text-[#8B8B92] font-normal text-[11px]">(optional)</span>
                          </div>
                          {clientProjects.length > 0 && canEdit && (
                            <div className="flex items-center gap-2 text-[11.5px]">
                              <button
                                type="button"
                                onClick={() => field.onChange(clientProjects.map((p: any) => p.id))}
                                className="text-[#EB5A1E] font-semibold hover:underline"
                              >
                                Select All
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                onClick={() => field.onChange([])}
                                className="text-[#8B8B92] hover:underline"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="border border-black/10 rounded-[10px] p-3 max-h-48 overflow-y-auto space-y-1.5 bg-[#FBFBFA]">
                          {clientProjects.length === 0 ? (
                            <p className="text-[12px] text-[#8B8B92] py-2 text-center">No active projects found</p>
                          ) : (
                            clientProjects.map((p: any) => {
                              const selected = (field.value || []).includes(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={cn(
                                    "flex items-center gap-2.5 p-2 rounded-[8px] cursor-pointer transition-colors text-[12.5px]",
                                    selected
                                      ? "bg-[#FFF4EE] text-[#17171A] font-semibold"
                                      : "hover:bg-black/[0.03] text-[#3F3F45]"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!canEdit}
                                    checked={selected}
                                    onChange={() => {
                                      const current = field.value || [];
                                      if (selected) {
                                        field.onChange(current.filter((id: string) => id !== p.id));
                                      } else {
                                        field.onChange([...current, p.id]);
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E] cursor-pointer"
                                  />
                                  <span className="truncate">{p.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <p className="text-[11px] text-[#8B8B92]">
                          {(field.value || []).length === 0
                            ? "No projects assigned."
                            : `Assigned to ${(field.value || []).length} project${(field.value || []).length > 1 ? "s" : ""}.`}
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {canEdit && (
                <div className="flex justify-end mt-[18px]">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-[38px] rounded-[9px] px-3.5 bg-[#EB5A1E] hover:bg-[#C64715] border-[#EB5A1E] text-white text-[12px] font-semibold"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </section>
          </form>
        </Form>

        {/* Security & Password Card */}
        {showPasswordCard && setAdminNewPassword && setAdminConfirmPassword && handleUpdatePassword && (
          <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
            <div className="mb-[17px]">
              <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Security & Password</div>
              <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
                Reset credentials without exposing the current password.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">New Password</div>
                <PasswordInput
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  showStrength
                  className="h-9 rounded-[9px] border-black/10 bg-[#FBFBFA] text-[12.5px]"
                />
              </div>
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                  Confirm Password
                </div>
                <PasswordInput
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-9 rounded-[9px] border-black/10 bg-[#FBFBFA] text-[12.5px]"
                />
              </div>
            </div>
            {adminPwError ? (
              <p className="text-[11px] text-[#C23A3A] mt-2.5">{adminPwError}</p>
            ) : null}
            <div className="flex justify-end mt-3.5">
              <Button
                type="button"
                onClick={handleUpdatePassword}
                disabled={settingPassword}
                className="h-[38px] rounded-[9px] px-3.5 bg-[#17171A] hover:bg-[#2C2C31] text-white text-[12px] font-semibold"
              >
                {settingPassword ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* Right sidebar: Client Member Snapshot */}
      <div className="flex flex-col gap-4 min-w-0">
        <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
          <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Client Member Snapshot</div>
          <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
            Account summary visible to administrators.
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-3.5">
            <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
              <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Status</div>
              <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">{statusLabel(status)}</div>
            </div>
            <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
              <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Role</div>
              <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">
                {roleLabel(watchRole || employee?.role || "client member")}
              </div>
            </div>
            <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
              <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Assigned Projects</div>
              <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">
                {(watchProjects || []).length}
              </div>
            </div>
            <div className="bg-[#F8F7F6] border border-black/[0.05] rounded-[10px] p-2.5 min-w-0">
              <div className="text-[9px] font-semibold text-[#A0A0A7] uppercase tracking-wide">Join Date</div>
              <div className="text-[12.5px] font-bold text-[#252529] mt-1 truncate">{joinLabel}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
