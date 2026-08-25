import React from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/employees/AvatarUpload";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTime12h } from "@/hooks/useWorkSettings";
import { adminSchema, DEPARTMENTS, EMP_TYPES, ROLES, REMINDER_OPTIONS } from "@/hooks/useEmployeeProfileData";

export interface EmployeeProfileTabProps {
  employee: any;
  avatarUrl: string;
  isOwnProfile: boolean;
  canEdit: boolean;
  saving: boolean;
  setAvatarFile: (file: File | null) => void;
  form: UseFormReturn<z.infer<typeof adminSchema>>;
  onSubmit: (data: z.infer<typeof adminSchema>) => Promise<void>;
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
}: EmployeeProfileTabProps) {
  return (
    <Card className="p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {isOwnProfile ? (
            <AvatarUpload currentUrl={avatarUrl} onFileChange={setAvatarFile} />
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-muted text-muted-foreground">{employee?.full_name?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="designation" render={({ field }) => (
              <FormItem>
                <FormLabel>Designation</FormLabel>
                <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="department" render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="join_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Join Date</FormLabel>
                <FormControl><Input {...field} type="date" disabled={!canEdit} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="employment_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Employment Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                  <FormControl><SelectTrigger><SelectValue>
                    <span className="capitalize">{field.value}</span>
                  </SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {EMP_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="shift_start" render={({ field }) => (
              <FormItem>
                <FormLabel>Shift Start (Override)</FormLabel>
                <FormControl><Input {...field} type="time" disabled={!canEdit} /></FormControl>
                <p className="text-xs text-muted-foreground">Currently: {formatTime12h(field.value)}. Leave as default to use global shift setting.</p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="shift_end" render={({ field }) => (
              <FormItem>
                <FormLabel>Shift End (Override)</FormLabel>
                <FormControl><Input {...field} type="time" disabled={!canEdit} /></FormControl>
                <p className="text-xs text-muted-foreground">Currently: {formatTime12h(field.value)}. Leave as default to use global shift setting.</p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="reminder_offset_minutes" render={({ field }) => (
              <FormItem>
                <FormLabel>Reminder Offset</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)} disabled={!canEdit}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="working_days" render={({ field }) => (
              <FormItem>
                <FormLabel>Working Days</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)} disabled={!canEdit}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                    <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Sets if employee is expected to work on Saturdays.</p>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {canEdit && (
            <FormField control={form.control} name="is_night_shift" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
                </FormControl>
                <div>
                  <FormLabel className="text-sm font-medium">Night Shift Employee</FormLabel>
                  <p className="text-xs text-muted-foreground">Skip automatic midnight clock-out for this employee</p>
                </div>
              </FormItem>
            )} />
          )}

          {canEdit && (
            <FormField control={form.control} name="overtime_enabled" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />
                </FormControl>
                <div>
                  <FormLabel className="text-sm font-medium">Overtime Enabled</FormLabel>
                  <p className="text-xs text-muted-foreground">Allow this employee to log overtime hours (beyond 8h) and submit logs on weekends</p>
                </div>
              </FormItem>
            )} />
          )}

          {!canEdit && !isOwnProfile && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">Contact your admin to change profile details.</p>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="rounded-button">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </Card>
  );
}
