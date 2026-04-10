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
import PlaceholderPage from "@/pages/Placeholder";
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
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected: set-password (needs session but no layout) */}
            <Route
              path="/set-password"
              element={
                <ProtectedRoute>
                  <SetPasswordPage />
                </ProtectedRoute>
              }
            />

            {/* Protected app routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />

              {/* Admin-only */}
              <Route path="/employees" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><PlaceholderPage title="Employees" /></ProtectedRoute>} />
              <Route path="/logs" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><PlaceholderPage title="All Daily Logs" /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><PlaceholderPage title="Reports" /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><PlaceholderPage title="Settings" /></ProtectedRoute>} />

              {/* Shared routes */}
              <Route path="/attendance" element={<PlaceholderPage title="Attendance" />} />
              <Route path="/leave" element={<PlaceholderPage title="Leave Management" />} />
              <Route path="/projects" element={<PlaceholderPage title="Projects" />} />
              <Route path="/announcements" element={<PlaceholderPage title="Announcements" />} />

              {/* Employee-only */}
              <Route path="/my-logs" element={<PlaceholderPage title="My Logs" />} />
              <Route path="/my-projects" element={<PlaceholderPage title="My Projects" />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
