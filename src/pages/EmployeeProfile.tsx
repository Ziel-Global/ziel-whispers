import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, ShieldOff } from "lucide-react";

import { useEmployeeProfileData } from "@/hooks/useEmployeeProfileData";
import { ClientMemberProfileCard } from "@/components/employee/ClientMemberProfileCard";
import { EmployeeProfileTab } from "@/components/employee/tabs/EmployeeProfileTab";
import { EmployeeWorkLogsTab } from "@/components/employee/tabs/EmployeeWorkLogsTab";
import { EmployeeProjectsTab } from "@/components/employee/tabs/EmployeeProjectsTab";
import { EmployeeLoggedHoursTab } from "@/components/employee/tabs/EmployeeLoggedHoursTab";
import { EmployeeLogEditDaysTab } from "@/components/employee/tabs/EmployeeLogEditDaysTab";
import { EmployeeAccessControlsTab } from "@/components/employee/tabs/EmployeeAccessControlsTab";
import { EmployeeSkillsTab } from "@/components/employee/tabs/EmployeeSkillsTab";

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const data = useEmployeeProfileData(id);

  if (data.isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (data.employeeError) return <div className="text-center py-12 text-muted-foreground">Failed to load employee. {(data.employeeError as any)?.message}</div>;
  if (!data.employee) return <div className="text-center py-12 text-muted-foreground">Employee not found</div>;

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-500",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={`${variants[status] || ""} capitalize`}>{status}</Badge>;
  };

  return (
    <div className="w-full space-y-6">
      {/* Header chrome left as-is (ud-* header restyle deferred). */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/employees"); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.employee.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {statusBadge(data.employee.status)}
              <span className="text-muted-foreground text-sm">{data.employee.designation} · {data.employee.department}</span>
            </div>
          </div>
        </div>
        {data.isAdmin && !data.isOwnProfile && (
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={data.employee.is_oversight ? "border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
                  disabled={data.togglingOversight}
                >
                  {data.employee.is_oversight ? "Remove Oversight" : "Mark as Oversight"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{data.employee.is_oversight ? "Remove Oversight?" : "Mark as Oversight?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {data.employee.is_oversight
                      ? "This employee will no longer be visually highlighted as needing closer attention."
                      : "This employee will be visually highlighted across admin pages for closer attention. This has no impact on their access or permissions."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={data.handleOversightToggle} className="bg-amber-500 text-white hover:bg-amber-600">
                    {data.employee.is_oversight ? "Remove Oversight" : "Mark as Oversight"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {data.employee.status === "active" || data.employee.status === "pending" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={data.deactivating}>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Deactivate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate Employee?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately revoke their system access and force logout. All historical data is preserved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={data.handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="outline" size="sm" onClick={data.handleReactivate} disabled={data.deactivating}>
                <Shield className="h-4 w-4 mr-2" />
                Reactivate
              </Button>
            )}
          </div>
        )}
      </div>

      {data.isClientMember ? (
        <ClientMemberProfileCard
          employee={data.employee}
          avatarUrl={data.avatarUrl}
          clientProjects={data.clientProjects}
          clientEditForm={data.clientEditForm}
          clientEditOnSubmit={data.clientEditOnSubmit}
          saving={data.saving}
        />
      ) : (
        <Tabs defaultValue="profile" className="w-full min-w-0">
          {/* ud-tabs strip — matches zielAdmin user-detail tab row */}
          <TabsList className="flex h-auto w-full min-h-[46px] items-center gap-1 bg-[#F6F5F3] border border-black/[0.06] rounded-[11px] p-[5px] overflow-x-auto scrollbar-none mb-4 shadow-none">
            <TabsTrigger
              value="profile"
              className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="skills"
              className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
            >
              Skills
            </TabsTrigger>
            {data.isAdmin && (
              <TabsTrigger
                value="projects"
                className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
              >
                Projects
              </TabsTrigger>
            )}
            {data.isAdmin && (
              <TabsTrigger
                value="logs"
                className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
              >
                Work Logs
              </TabsTrigger>
            )}
            {data.isAdmin && (
              <TabsTrigger
                value="logged-hours"
                className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
              >
                Logged Hours
              </TabsTrigger>
            )}
            {data.isAdmin && (
              <TabsTrigger
                value="log-edit-days"
                className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
              >
                Log Edit Days
              </TabsTrigger>
            )}
            {data.isAdmin && (
              <TabsTrigger
                value="access-controls"
                className="h-[34px] px-2.5 rounded-lg flex-1 min-w-[108px] text-[12px] font-medium text-[#7D7D84] data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-none hover:text-[#3F3F45] hover:bg-white/55"
              >
                Access Controls
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile" className="mt-0">
            <EmployeeProfileTab
              employee={data.employee}
              avatarUrl={data.avatarUrl}
              isOwnProfile={data.isOwnProfile}
              canEdit={data.canEdit}
              saving={data.saving}
              setAvatarFile={data.setAvatarFile}
              form={data.form}
              onSubmit={data.onSubmit}
              employeeProjects={data.employeeProjects}
              monthlyStats={data.monthlyStats}
            />
          </TabsContent>

          <TabsContent value="skills">
            <EmployeeSkillsTab
              userId={data.employee.id}
              isAdmin={data.isAdmin}
              isOwnProfile={data.isOwnProfile}
            />
          </TabsContent>

          {data.isAdmin && (
            <TabsContent value="projects">
              <EmployeeProjectsTab employeeProjects={data.employeeProjects} />
            </TabsContent>
          )}

          {data.isAdmin && (
            <TabsContent value="logs">
              <EmployeeWorkLogsTab
                totalLoggedHours={data.totalLoggedHours}
                logDateFilter={data.logDateFilter}
                setLogDateFilter={data.setLogDateFilter}
                logProjectFilter={data.logProjectFilter}
                setLogProjectFilter={data.setLogProjectFilter}
                logActivityFilter={data.logActivityFilter}
                setLogActivityFilter={data.setLogActivityFilter}
                employeeProjects={data.employeeProjects}
                exportWorkLogs={data.exportWorkLogs}
                workLogs={data.workLogs}
                selectedLogIds={data.selectedLogIds}
                setSelectedLogIds={data.setSelectedLogIds}
                setBulkDeleteLogOpen={data.setBulkDeleteLogOpen}
                setDeleteLogId={data.setDeleteLogId}
                deleteLogId={data.deleteLogId}
                handleDeleteLog={data.handleDeleteLog}
                bulkDeleteLogOpen={data.bulkDeleteLogOpen}
                handleBulkDeleteLogs={data.handleBulkDeleteLogs}
              />
            </TabsContent>
          )}

          {data.isAdmin && (
            <TabsContent value="logged-hours">
              <EmployeeLoggedHoursTab
                loggedHoursMonth={data.loggedHoursMonth}
                setLoggedHoursMonth={data.setLoggedHoursMonth}
                monthStart={data.monthStart}
                monthlyStats={data.monthlyStats}
              />
            </TabsContent>
          )}

          {data.isAdmin && (
            <TabsContent value="log-edit-days">
              <EmployeeLogEditDaysTab
                logEditDays={data.logEditDays}
                setLogEditDays={data.setLogEditDays}
                savingLogEditDays={data.savingLogEditDays}
                handleSaveLogEditDays={data.handleSaveLogEditDays}
              />
            </TabsContent>
          )}

          {data.isAdmin && (
            <TabsContent value="access-controls">
              <EmployeeAccessControlsTab
                employeeRemoteAccess={data.employeeRemoteAccess}
                setEmployeeRemoteAccess={data.setEmployeeRemoteAccess}
                employeeRemoteAccessFrom={data.employeeRemoteAccessFrom}
                setEmployeeRemoteAccessFrom={data.setEmployeeRemoteAccessFrom}
                employeeRemoteAccessTo={data.employeeRemoteAccessTo}
                setEmployeeRemoteAccessTo={data.setEmployeeRemoteAccessTo}
                employeeIsOnLeave={data.employeeIsOnLeave}
                setEmployeeIsOnLeave={data.setEmployeeIsOnLeave}
                employeeIsOnLeaveFrom={data.employeeIsOnLeaveFrom}
                setEmployeeIsOnLeaveFrom={data.setEmployeeIsOnLeaveFrom}
                employeeIsOnLeaveTo={data.employeeIsOnLeaveTo}
                setEmployeeIsOnLeaveTo={data.setEmployeeIsOnLeaveTo}
                savingAccessControls={data.savingAccessControls}
                handleSaveAccessControls={data.handleSaveAccessControls}
                employee={data.employee}
                logEditDays={data.logEditDays}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      <Dialog open={data.emailWarningOpen} onOpenChange={data.setEmailWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Changing the email from <strong>{data.employee.email}</strong> to <strong>{data.pendingEmail}</strong> will update their login credentials. This action cannot be undone easily.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => data.setEmailWarningOpen(false)}>Cancel</Button>
            <Button onClick={data.confirmEmailChange} disabled={data.saving}>Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}