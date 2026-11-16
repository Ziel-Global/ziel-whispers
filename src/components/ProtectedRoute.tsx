import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { WorkspaceSuspendedScreen } from "@/components/WorkspaceSuspendedScreen";

type Props = {
  children: React.ReactNode;
  allowedRoles?: string[];
};

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { session, profile, isSuspended, isSSA, loading } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  // If user is an SSA, they possess universal access to platform views
  const unauthorized = !!(
    allowedRoles &&
    profile &&
    !isSSA &&
    !allowedRoles.includes(profile.role)
  );

  useEffect(() => {
    if (unauthorized && !toastShown.current) {
      toastShown.current = true;
      toast.error("You do not have access to that page");
    }
  }, [unauthorized]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Intercept suspended workspace before loading any application routes
  if (isSuspended && !isSSA) {
    return <WorkspaceSuspendedScreen />;
  }

  if (location.pathname === "/set-password" && profile && !profile.must_change_password) {
    try {
      const justSet = localStorage.getItem("_zl_just_set_password");
      if (justSet === "1") {
        // allow staying on /set-password until client finishes sign-out
      } else {
        return <Navigate to="/" replace />;
      }
    } catch {
      return <Navigate to="/" replace />;
    }
  }

  if (profile?.must_change_password && location.pathname !== "/set-password") {
    return <Navigate to="/set-password" replace />;
  }

  if (unauthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
