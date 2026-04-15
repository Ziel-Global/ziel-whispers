import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/Login";
import SetPasswordPage from "@/pages/SetPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
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
import AnnouncementsPage from "@/pages/Announcements";
import ReportsPage from "@/pages/Reports";
import SettingsPage from "@/pages/Settings";
import AuditLogPage from "@/pages/AuditLog";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/set-password" element={<ProtectedRoute><SetPasswordPage /></ProtectedRoute>} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<DashboardPage />} />

              {/* Employee Management — admin only */}
              <Route path="/employees" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeesPage /></ProtectedRoute>} />
              <Route path="/employees/new" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeeNewPage /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute allowedRoles={["admin"]}><EmployeeProfilePage /></ProtectedRoute>} />
              <Route path="/profile" element={<MyProfilePage />} />

              {/* Attendance */}
              <Route path="/attendance/my" element={<MyAttendancePage />} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><AttendanceAdminPage /></ProtectedRoute>} />

              {/* Daily Logs */}
              <Route path="/logs/submit" element={<LogSubmitPage />} />
              <Route path="/logs/my" element={<MyLogsPage />} />
              <Route path="/logs/all" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><LogsAdminPage /></ProtectedRoute>} />

              {/* Leave */}
              <Route path="/leave/my" element={<MyLeavePage />} />
              <Route path="/leave/requests" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><LeaveAdminPage /></ProtectedRoute>} />

              {/* Clients & Projects */}
              <Route path="/clients" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><ClientsPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><ProjectNewPage /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />

              {/* Other */}
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><ReportsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><SettingsPage /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLogPage /></ProtectedRoute>} />
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
