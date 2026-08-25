import React from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { clientEditSchema } from "@/hooks/useEmployeeProfileData";

export interface ClientMemberProfileCardProps {
  employee: any;
  avatarUrl: string;
  clientProjects: any[];
  clientEditForm: UseFormReturn<z.infer<typeof clientEditSchema>>;
  clientEditOnSubmit: (data: z.infer<typeof clientEditSchema>) => Promise<void>;
  saving: boolean;
}

export function ClientMemberProfileCard({
  employee,
  avatarUrl,
  clientProjects,
  clientEditForm,
  clientEditOnSubmit,
  saving,
}: ClientMemberProfileCardProps) {
  return (
    <Card className="p-6">
      <div className="mb-6 p-4 rounded-lg bg-muted border border-border text-sm text-foreground">
        <p className="font-semibold mb-1">Client Member Profile</p>
        <p className="text-muted-foreground">Edit the client member's details below. Changes will be saved immediately.</p>
      </div>
      <Form {...clientEditForm}>
        <form onSubmit={clientEditForm.handleSubmit(clientEditOnSubmit)} className="space-y-5">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-muted text-muted-foreground">{employee?.full_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>

          <FormField control={clientEditForm.control} name="full_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input {...field} placeholder="e.g. Sara Ahmed" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={clientEditForm.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input {...field} type="email" placeholder="member@client-company.com" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={clientEditForm.control} name="project_ids" render={({ field }) => (
            <FormItem>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Assign to Projects <span className="text-muted-foreground text-xs">(optional)</span>
                  </label>
                  {clientProjects.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button type="button" onClick={() => field.onChange(clientProjects.map((p: any) => p.id))} className="text-blue-600 hover:underline">Select All</button>
                      <span className="text-gray-300">|</span>
                      <button type="button" onClick={() => field.onChange([])} className="text-gray-500 hover:underline">Clear</button>
                    </div>
                  )}
                </div>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-background">
                  {clientProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No active projects found</p>
                  ) : (
                    clientProjects.map((p: any) => {
                      const selected = (field.value || []).includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2.5 p-2 rounded cursor-pointer transition-colors text-sm ${
                            selected ? "bg-blue-50/70 text-blue-900 font-medium" : "hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const current = field.value || [];
                              if (selected) {
                                field.onChange(current.filter((id: string) => id !== p.id));
                              } else {
                                field.onChange([...current, p.id]);
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(field.value || []).length === 0
                    ? "No projects assigned."
                    : `Assigned to ${(field.value || []).length} project${(field.value || []).length > 1 ? "s" : ""}.`}
                </p>
              </div>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit" disabled={saving} className="rounded-button">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
