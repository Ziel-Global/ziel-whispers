import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";

// Route-level code splitting using React.lazy for instant initial bundle loading
const LoginPage = lazy(() => import("@/pages/Login"));
const SetPasswordPage = lazy(() => import("@/pages/SetPassword"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const EmployeesPage = lazy(() => import("@/pages/Employees"));
const EmployeeNewPage = lazy(() => import("@/pages/EmployeeNew"));
const EmployeeProfilePage = lazy(() => import("@/pages/EmployeeProfile"));
const MyProfilePage = lazy(() => import("@/pages/MyProfile"));
const MyAttendancePage = lazy(() => import("@/pages/MyAttendance"));
const AttendanceAdminPage = lazy(() => import("@/pages/AttendanceAdmin"));
const LogSubmitPage = lazy(() => import("@/pages/LogSubmit"));
const MyLogsPage = lazy(() => import("@/pages/MyLogs"));
const LogsAdminPage = lazy(() => import("@/pages/LogsAdmin"));
const MyLeavePage = lazy(() => import("@/pages/MyLeave"));
const LeaveAdminPage = lazy(() => import("@/pages/LeaveAdmin"));
const ClientsPage = lazy(() => import("@/pages/Clients"));
const ProjectsPage = lazy(() => import("@/pages/Projects"));
const ProjectNewPage = lazy(() => import("@/pages/ProjectNew"));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetail"));
const PhaseEditPage = lazy(() => import("@/pages/PhaseEditPage"));
const AnnouncementsPage = lazy(() => import("@/pages/Announcements"));
const ReportsPage = lazy(() => import("@/pages/Reports"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const AuditLogPage = lazy(() => import("@/pages/AuditLog"));
const WorkflowTemplatesPage = lazy(() => import("@/pages/WorkflowTemplates"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
    },
  },
});

const PageFallback = () => (
  <div className="flex h-[60vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

function HomeRouter() {
  const { profile } = useAuth();
  if (
    profile?.role === "client" ||
    profile?.role === "client member" ||
    profile?.role === "client portal"
  ) {
    return (
      <Navigate
        to={profile?.role === "client portal" ? "/portal" : "/projects"}
        replace
      />
    );
  }
  return <Navigate to="/dashboard" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/set-password"
                element={
                  <ProtectedRoute>
                    <SetPasswordPage />
                  </ProtectedRoute>
                }
              />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<HomeRouter />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Employee Management — admin only */}
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <EmployeesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/new"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <EmployeeNewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <EmployeeProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/profile" element={<MyProfilePage />} />

                {/* Attendance */}
                <Route path="/attendance/my" element={<MyAttendancePage />} />
                <Route
                  path="/attendance"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <AttendanceAdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Daily Logs */}
                <Route path="/logs/submit" element={<LogSubmitPage />} />
                <Route path="/logs/my" element={<MyLogsPage />} />
                <Route
                  path="/logs/all"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <LogsAdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Leave */}
                <Route path="/leave/my" element={<MyLeavePage />} />
                <Route
                  path="/leave/requests"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <LeaveAdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Clients & Projects */}
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <ClientsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route
                  path="/projects/new"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <ProjectNewPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/projects/:slug" element={<ProjectDetailPage />} />
                <Route
                  path="/projects/:slug/phases/:phaseId"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <PhaseEditPage />
                    </ProtectedRoute>
                  }
                />

                {/* Client Portal */}
                <Route path="/portal" element={<ProjectsPage />} />
                <Route path="/portal/:slug" element={<ProjectDetailPage />} />

                {/* Other */}
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AuditLogPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workflow-templates"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <WorkflowTemplatesPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/my-projects" element={<ProjectsPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
