import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ListPlus, Calendar as CalendarIcon, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, MISC_PROJECT_ID } from "@/lib/utils";
import { CATEGORIES, isWithinLogEditWindow } from "@/utils/logDateUtils";
import { PRIORITY_COLORS, getStatusDisplay, getStatusColor } from "@/lib/workflow";

export interface LogSubmissionFormCardProps {
  form: any;
  projects: any[];
  editId: string | null;
  isLocked: boolean;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  overtimeEnabled: boolean;
  workingDays: number;
  effectiveLogEditDays: number;
  today: string;
  logsTotals: Record<string, number>;
  selectedProjectId: string;
  tasksWithRemaining: any[];
  selectedTask: any;
  workflowStatuses: any[] | null;
  allowedTransitions: any[];
  declareOutcome: boolean;
  setDeclareOutcome: (v: boolean) => void;
  selectedOutcomeStatusId: string;
  setSelectedOutcomeStatusId: (id: string) => void;
  dependencyWarning: string;
  descValue: string;
  selectedDate: string;
  totalHoursForSelectedDate: number;
  onAddLog: (data: any) => Promise<void>;
  cancelEdit: () => void;
  navigate: (path: string) => void;
}

export function LogSubmissionFormCard({
  form,
  projects,
  editId,
  isLocked,
  isCalendarOpen,
  setIsCalendarOpen,
  overtimeEnabled,
  workingDays,
  effectiveLogEditDays,
  today,
  logsTotals,
  selectedProjectId,
  tasksWithRemaining,
  selectedTask,
  workflowStatuses,
  allowedTransitions,
  declareOutcome,
  setDeclareOutcome,
  selectedOutcomeStatusId,
  setSelectedOutcomeStatusId,
  dependencyWarning,
  descValue,
  selectedDate,
  totalHoursForSelectedDate,
  onAddLog,
  cancelEdit,
  navigate,
}: LogSubmissionFormCardProps) {
  return (
    <Card className="p-6 border-2 border-primary/5 shadow-lg bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-primary rounded-lg text-primary">
          <ListPlus className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">
          {editId ? "Edit Log Entry" : "Add New Log Entry"}
        </h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onAddLog)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Project
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={MISC_PROJECT_ID}>Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Category
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Duration (Hours)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max={24}
                      className="bg-background"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      disabled={isLocked}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="log_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Log Date
                  </FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-background h-10",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isLocked}
                        >
                          {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(format(date, "yyyy-MM-dd"));
                            setIsCalendarOpen(false);
                          }
                        }}
                        disabled={(date) => {
                          const dateStr = format(date, "yyyy-MM-dd");
                          const day = date.getDay();

                          if (!overtimeEnabled) {
                            if (day === 0) return true;
                            if (day === 6 && workingDays === 5) return true;
                          }

                          if (!isWithinLogEditWindow(dateStr, today, effectiveLogEditDays, workingDays)) return true;
                          if ((logsTotals[dateStr] || 0) >= 24) return true;
                          if (date > new Date()) return true;

                          return false;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {selectedProjectId && selectedProjectId !== MISC_PROJECT_ID && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Task (Required) *
              </span>
              <div className="space-y-1">
                {tasksWithRemaining.map((t: any) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-2.5 border rounded-md cursor-pointer transition-colors ${
                      form.watch("task_id") === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() =>
                      form.setValue(
                        "task_id",
                        form.watch("task_id") === t.id ? null : t.id,
                        { shouldDirty: true, shouldValidate: true }
                      )
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          form.watch("task_id") === t.id ? "border-primary" : "border-muted-foreground"
                        }`}
                      >
                        {form.watch("task_id") === t.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm font-medium truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {t.remaining_hours !== null && (
                        <span className="text-xs text-muted-foreground">{t.remaining_hours}h left</span>
                      )}
                      <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                  </div>
                ))}
                <div
                  key="other-task-option"
                  className={`flex items-center justify-between p-2.5 border rounded-md cursor-pointer transition-colors ${
                    form.watch("task_id") === "other" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() =>
                    form.setValue(
                      "task_id",
                      form.watch("task_id") === "other" ? null : "other",
                      { shouldDirty: true, shouldValidate: true }
                    )
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        form.watch("task_id") === "other" ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {form.watch("task_id") === "other" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm font-medium truncate">Other</span>
                  </div>
                </div>
              </div>
              {form.formState.errors.task_id && (
                <p className="text-xs font-medium text-destructive mt-1">
                  {form.formState.errors.task_id.message as string}
                </p>
              )}
            </div>
          )}

          {selectedTask && selectedTask.id !== "other" && selectedTask.status_id && workflowStatuses && allowedTransitions.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="declare-outcome"
                  checked={declareOutcome}
                  onChange={(e) => {
                    setDeclareOutcome(e.target.checked);
                    if (!e.target.checked) setSelectedOutcomeStatusId("");
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="declare-outcome" className="text-sm cursor-pointer select-none">
                  <span className="font-medium">Change Task Status</span>
                  <span className="block text-xs text-muted-foreground">
                    Tick this to move the task to its next stage when you submit this log.
                  </span>
                </label>
              </div>

              {declareOutcome && (
                <div className="ml-7 space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Your log will move</span>{" "}
                    <span className="font-medium">{selectedTask.title}</span>{" "}
                    <span className="text-muted-foreground">to the next stage:</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(workflowStatuses, selectedTask.status_id)}>
                      {getStatusDisplay(workflowStatuses, selectedTask.status_id).name}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    {allowedTransitions.length === 1 ? (
                      <Badge className={getStatusColor(workflowStatuses, allowedTransitions[0].id)}>
                        {getStatusDisplay(workflowStatuses, allowedTransitions[0].id).name}
                      </Badge>
                    ) : (
                      <Select value={selectedOutcomeStatusId} onValueChange={setSelectedOutcomeStatusId}>
                        <SelectTrigger className="w-[220px] h-9">
                          <SelectValue placeholder="Which stage actually happened?" />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedTransitions.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}

              {dependencyWarning && (
                <div className="ml-7 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                  <span className="font-medium">⚠ {dependencyWarning}</span>
                </div>
              )}
            </div>
          )}

          {(selectedProjectId === MISC_PROJECT_ID || Boolean(form.watch("task_id"))) && (
            <>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Description
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        className="bg-background resize-none"
                        placeholder="Explain your progress..."
                        disabled={isLocked}
                      />
                    </FormControl>
                    <div className="flex justify-between items-center px-1">
                      <FormMessage />
                      <span
                        className={`text-[10px] font-mono ${
                          descValue?.length < 20 ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {descValue?.length || 0} / 20 chars min
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              {isLocked ? (
                <div className="bg-muted p-6 rounded-xl border-2 border-dashed flex flex-col items-center text-center space-y-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">Daily Limit Reached</p>
                    <p className="text-sm text-muted-foreground">
                      You have already submitted logs for {format(parseISO(selectedDate), "MMM do")}.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/logs/my")}
                    className="rounded-button"
                  >
                    Go to My Logs
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end gap-3 pt-2">
                  {editId && (
                    <Button type="button" variant="ghost" onClick={cancelEdit} className="rounded-button">
                      Cancel Edit
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className="rounded-button px-8"
                    disabled={!overtimeEnabled && totalHoursForSelectedDate >= 24 && !editId}
                  >
                    {editId ? "Update Log Entry" : "Add Log Entry"}
                  </Button>
                </div>
              )}
            </>
          )}
        </form>
      </Form>
    </Card>
  );
}
