import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  allowedRoles?: string[];
};

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  const unauthorized = !!(allowedRoles && profile && !allowedRoles.includes(profile.role));

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

  if (profile?.must_change_password && location.pathname !== "/set-password") {
    return <Navigate to="/set-password" replace />;
  }

  if (unauthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
