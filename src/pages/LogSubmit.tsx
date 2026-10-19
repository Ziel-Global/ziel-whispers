import React from "react";
import { AlertCircle } from "lucide-react";
import { useLogSubmitData } from "@/hooks/useLogSubmitData";
import { LogProgressHeader } from "@/components/log-submit/LogProgressHeader";
import { LogSubmissionFormCard } from "@/components/log-submit/LogSubmissionFormCard";
import { PendingDraftLogsList } from "@/components/log-submit/PendingDraftLogsList";
import { SubmittedDateLogsHistory } from "@/components/log-submit/SubmittedDateLogsHistory";
import { LogSubmitModals } from "@/components/log-submit/LogSubmitModals";

export default function LogSubmitPage() {
  const data = useLogSubmitData();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header & Daily Hours Progress */}
      <LogProgressHeader
        selectedDate={data.selectedDate}
        expectedDailyHours={data.expectedDailyHours}
        totalHoursForSelectedDate={data.totalHoursForSelectedDate}
        submittedHours={data.submittedHours}
        progressPercentage={data.progressPercentage}
        remainingHoursForTarget={data.remainingHoursForTarget}
      />

      {/* Main Form Card */}
      <LogSubmissionFormCard
        form={data.form}
        projects={data.projects}
        editId={data.editId}
        isLocked={data.isLocked}
        isCalendarOpen={data.isCalendarOpen}
        setIsCalendarOpen={data.setIsCalendarOpen}
        overtimeEnabled={data.overtimeEnabled}
        workingDays={data.workingDays}
        effectiveLogEditDays={data.effectiveLogEditDays}
        today={data.today}
        logsTotals={data.logsTotals}
        selectedProjectId={data.selectedProjectId}
        tasksWithRemaining={data.tasksWithRemaining}
        selectedTask={data.selectedTask}
        workflowStatuses={data.workflowStatuses}
        allowedTransitions={data.allowedTransitions}
        declareOutcome={data.declareOutcome}
        setDeclareOutcome={data.setDeclareOutcome}
        selectedOutcomeStatusId={data.selectedOutcomeStatusId}
        setSelectedOutcomeStatusId={data.setSelectedOutcomeStatusId}
        dependencyWarning={data.dependencyWarning}
        descValue={data.descValue}
        selectedDate={data.selectedDate}
        totalHoursForSelectedDate={data.totalHoursForSelectedDate}
        onAddLog={data.onAddLog}
        cancelEdit={data.cancelEdit}
        navigate={data.navigate}
      />

      {/* Unsubmitted Pending Draft Logs */}
      <PendingDraftLogsList
        pendingLogs={data.pendingLogs}
        selectedDraftIds={data.selectedDraftIds}
        setSelectedDraftIds={data.setSelectedDraftIds}
        setBulkDeleteDraftOpen={data.setBulkDeleteDraftOpen}
        setShowSubmitConfirm={data.setShowSubmitConfirm}
        submitting={data.submitting}
        startEdit={data.startEdit}
        setDeleteConfirmId={data.setDeleteConfirmId}
      />

      {/* Submitted Logs History for Selected Date */}
      <SubmittedDateLogsHistory
        dateLogs={data.dateLogs}
        selectedDate={data.selectedDate}
        resolvedShiftEnd={data.resolvedShiftEnd}
      />

      {/* Help Info Footer */}
      <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border-black border border-2 border-dashed text-muted-foreground">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-xs">
          {data.overtimeEnabled
            ? "Tip: Overtime is enabled for your account. You can log hours beyond 8h and submit logs on weekends. Hours above 8h per day are tracked as overtime."
            : "Tip: You can select a past date to submit logs you might have missed. You can submit multiple logs for the same day until you reach the daily limit."}
        </p>
      </div>

      {/* Confirmation & Action Modals */}
      <LogSubmitModals
        showSubmitConfirm={data.showSubmitConfirm}
        setShowSubmitConfirm={data.setShowSubmitConfirm}
        pendingLogs={data.pendingLogs}
        declaredMoves={data.declaredMoves}
        logsAreAllForToday={data.logsAreAllForToday}
        handleSubmitAll={data.handleSubmitAll}
        deleteConfirmId={data.deleteConfirmId}
        setDeleteConfirmId={data.setDeleteConfirmId}
        removePendingLog={data.removePendingLog}
        bulkDeleteDraftOpen={data.bulkDeleteDraftOpen}
        setBulkDeleteDraftOpen={data.setBulkDeleteDraftOpen}
        selectedDraftIds={data.selectedDraftIds}
        handleBulkDeleteDrafts={data.handleBulkDeleteDrafts}
      />
    </div>
  );
}
