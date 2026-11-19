import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { isClientRole } from "@/lib/workflow";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/Login";
import SetPasswordPage from "@/pages/SetPassword";
import DashboardPage from "@/pages/Dashboard";
import EmployeesPage from "@/pages/Employees";
import EmployeeNewPage from "@/pages/EmployeeNew";
import EmployeeProfilePage from "@/pages/EmployeeProfile";
import MyProfilePage from "@/pages/MyProfile";
import MyAttendancePage from "@/pages/MyAttendance";
import AttendanceAdminPage from "@/pages/AttendanceAdmin";
import LogSubmitPage from "@/pages/LogSubmit";
import MyLogsPage from "@/pages/MyLogs";
import LogsAdminPage from "@/pages/LogsAdmin";
import MyLeavePage from "@/pages/MyLeave";
import LeaveAdminPage from "@/pages/LeaveAdmin";
import ClientsPage from "@/pages/Clients";
import ProjectsPage from "@/pages/Projects";
import ProjectNewPage from "@/pages/ProjectNew";
import ProjectDetailPage from "@/pages/ProjectDetail";
import PhaseEditPage from "@/pages/PhaseEditPage";
import AnnouncementsPage from "@/pages/Announcements";
import ReportsPage from "@/pages/Reports";
import SettingsPage from "@/pages/Settings";
import AuditLogPage from "@/pages/AuditLog";
import WorkflowTemplatesPage from "@/pages/WorkflowTemplates";
import NotificationsPage from "@/pages/Notifications";
import ExecutiveDashboardPage from "@/pages/ExecutiveDashboard";
import DepartmentDashboardPage from "@/pages/DepartmentDashboard";
import TeamLeadDashboardPage from "@/pages/TeamLeadDashboard";
import AlertsCenterPage from "@/pages/AlertsCenter";
import FinancialsDashboardPage from "@/pages/FinancialsDashboard";
import SkillsStaffingDashboardPage from "@/pages/SkillsStaffingDashboard";
import KpiSettingsPage from "@/pages/KpiSettings";
import PlatformAdminPage from "@/pages/PlatformAdmin";
import TenantsPage from "@/pages/TenantsPage";
import PlatformAdminsPage from "@/pages/PlatformAdminsPage";
import PlatformAnalyticsPage from "@/pages/PlatformAnalyticsPage";
import SuperAdminLoginPage from "@/pages/SuperAdminLogin";
import { SuperAdminProtectedRoute } from "@/components/SuperAdminProtectedRoute";
import { SSADashboard } from "@/components/platform-admin/SSADashboard";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function HomeRouter() {
  const { profile, isSSA, loading } = useAuth();
  if (loading) {
    return <div className="flex flex-1 items-center justify-center animate-pulse text-muted-foreground">Loading…</div>;
  }
  if (isSSA) {
    const isOtpVerified = typeof window !== "undefined" && sessionStorage.getItem("ziel_ssa_otp_verified") === "true";
    if (!isOtpVerified) {
      return <Navigate to="/super-admin/login" replace />;
    }
    return <Navigate to="/super-admin/dashboard" replace />;
  }
  if (!profile) {
    return <div className="flex flex-1 items-center justify-center animate-pulse text-muted-foreground">Loading…</div>;
  }
  if (isClientRole(profile)) {
    return <Navigate to="/projects" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
            <Route path="/set-password" element={<ProtectedRoute><SetPasswordPage /></ProtectedRoute>} />

            {/* Backwards-compatibility redirects for existing platform bookmarks */}
            <Route path="/tenants" element={<Navigate to="/super-admin/tenants" replace />} />
            <Route path="/platform-admins" element={<Navigate to="/super-admin/admins" replace />} />
            <Route path="/platform-analytics" element={<Navigate to="/super-admin/analytics" replace />} />
            <Route path="/platform-admin" element={<Navigate to="/super-admin/tenants" replace />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<HomeRouter />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Super Super Admin Console — Same AppLayout, Dedicated /super-admin URLs */}
              <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
              <Route path="/super-admin/dashboard" element={<SuperAdminProtectedRoute><SSADashboard /></SuperAdminProtectedRoute>} />
              <Route path="/super-admin/tenants" element={<SuperAdminProtectedRoute><TenantsPage /></SuperAdminProtectedRoute>} />
              <Route path="/super-admin/admins" element={<SuperAdminProtectedRoute><PlatformAdminsPage /></SuperAdminProtectedRoute>} />
              <Route path="/super-admin/analytics" element={<SuperAdminProtectedRoute><PlatformAnalyticsPage /></SuperAdminProtectedRoute>} />
              <Route path="/super-admin/audit" element={<SuperAdminProtectedRoute><AuditLogPage /></SuperAdminProtectedRoute>} />
              <Route path="/super-admin/settings" element={<SuperAdminProtectedRoute><SettingsPage /></SuperAdminProtectedRoute>} />

              {/* Employee Management — admin only */}
              <Route path="/employees" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeesPage /></ProtectedRoute>} />
              <Route path="/employees/new" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeeNewPage /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeeProfilePage /></ProtectedRoute>} />
              <Route path="/profile" element={<MyProfilePage />} />

              {/* Attendance */}
              <Route path="/attendance/my" element={<MyAttendancePage />} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={["admin", "hr_manager"]}><AttendanceAdminPage /></ProtectedRoute>} />

              {/* Daily Logs */}
              <Route path="/logs/submit" element={<LogSubmitPage />} />
              <Route path="/logs/my" element={<MyLogsPage />} />
              <Route path="/logs/all" element={<ProtectedRoute allowedRoles={["admin", "hr_manager", "project_manager"]}><LogsAdminPage /></ProtectedRoute>} />

              {/* Leave */}
              <Route path="/leave/my" element={<MyLeavePage />} />
              <Route path="/leave/requests" element={<ProtectedRoute allowedRoles={["admin", "hr_manager"]}><LeaveAdminPage /></ProtectedRoute>} />

              {/* Clients & Projects */}
              <Route path="/clients" element={<ProtectedRoute allowedRoles={["admin", "project_manager"]}><ClientsPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<ProtectedRoute allowedRoles={["admin", "project_manager"]}><ProjectNewPage /></ProtectedRoute>} />
              <Route path="/projects/:slug" element={<ProjectDetailPage />} />
              <Route path="/projects/:slug/phases/:phaseId" element={<ProtectedRoute allowedRoles={["admin", "project_manager"]}><PhaseEditPage /></ProtectedRoute>} />

              {/* Analytics & Dashboards */}
              <Route path="/analytics" element={<ProtectedRoute allowedRoles={["admin", "hr_manager", "project_manager"]}><ExecutiveDashboardPage /></ProtectedRoute>} />
              <Route path="/analytics/department" element={<ProtectedRoute allowedRoles={["admin", "hr_manager", "project_manager"]}><DepartmentDashboardPage /></ProtectedRoute>} />
              <Route path="/analytics/team" element={<ProtectedRoute allowedRoles={["admin", "hr_manager", "project_manager", "employee"]}><TeamLeadDashboardPage /></ProtectedRoute>} />
              <Route path="/analytics/alerts" element={<ProtectedRoute allowedRoles={["admin", "hr_manager", "project_manager"]}><AlertsCenterPage /></ProtectedRoute>} />
              <Route path="/analytics/financials" element={<ProtectedRoute allowedRoles={["admin"]}><FinancialsDashboardPage /></ProtectedRoute>} />
              <Route path="/analytics/skills-staffing" element={<ProtectedRoute allowedRoles={["admin", "project_manager"]}><SkillsStaffingDashboardPage /></ProtectedRoute>} />
              <Route path="/analytics/kpi-settings" element={<ProtectedRoute allowedRoles={["admin"]}><KpiSettingsPage /></ProtectedRoute>} />

              {/* Other */}
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "hr_manager", "project_manager"]}><ReportsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><SettingsPage /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLogPage /></ProtectedRoute>} />
              <Route path="/workflow-templates" element={<ProtectedRoute allowedRoles={["admin", "project_manager"]}><WorkflowTemplatesPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/my-projects" element={<ProjectsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
