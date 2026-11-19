import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
};

export function SuperAdminProtectedRoute({ children }: Props) {
  const { session, isSSA, loading } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  const isOtpVerified = typeof window !== "undefined" && sessionStorage.getItem("ziel_ssa_otp_verified") === "true";

  const unauthorized = !loading && !!session && !isSSA;
  const needsOtp = !loading && !!session && isSSA && !isOtpVerified;

  useEffect(() => {
    if (unauthorized && !toastShown.current) {
      toastShown.current = true;
      toast.error("Access Denied: Restricted to Platform Super Admins only.");
    } else if (needsOtp && !toastShown.current) {
      toastShown.current = true;
      toast.error("Two-step verification required. Please verify your security code to continue.");
    }
  }, [unauthorized, needsOtp]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Not logged in or has not verified OTP -> send to dedicated Super Admin login page
  if (!session || needsOtp) {
    return <Navigate to="/super-admin/login" state={{ from: location }} replace />;
  }

  // Logged in, but NOT a Super Super Admin -> bounce to standard tenant dashboard
  if (unauthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
