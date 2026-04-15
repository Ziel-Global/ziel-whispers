import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const hasReset = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in (not during recovery)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const isRecoveryLink = hash.get("type") === "recovery" || hash.has("access_token");
        if (!isRecoveryLink) {
          navigate("/", { replace: true });
          return;
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
      // Detect token errors
      if (event === "SIGNED_OUT" && !hasReset.current && !resetComplete) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hasToken = hash.get("type") === "recovery" || hash.has("access_token");
        if (hasToken) {
          setTokenInvalid(true);
        }
      }
    });

    // Check URL hash for recovery token
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hasRecoveryToken = hash.get("type") === "recovery" || hash.has("access_token");
    if (hasRecoveryToken) {
      // Check for error in hash (expired/used token)
      const error = hash.get("error_description") || hash.get("error");
      if (error) {
        setTokenInvalid(true);
      } else {
        setIsRecovery(true);
      }
    }

    return () => subscription.unsubscribe();
  }, [navigate, resetComplete]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); } else { setSent(true); toast.success("Check your email for the reset link"); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasReset.current || resetComplete) return;
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!/[0-9]/.test(password)) { toast.error("Password must contain at least one number"); return; }
    if (!/[^a-zA-Z0-9]/.test(password)) { toast.error("Password must contain at least one special character"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    hasReset.current = true;

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      hasReset.current = false;
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({ must_change_password: false }).eq("id", user.id);
      await supabase.from("audit_logs").insert({
        actor_id: user.id, action: "user.password_reset", target_entity: "users", target_id: user.id,
      });
    }

    // Mark reset as complete before signing out
    setResetComplete(true);
    setLoading(false);

    // Sign out so user goes through clean login
    await supabase.auth.signOut();

    toast.success("Your password has been reset successfully.");

    // Redirect to login after brief delay, using replace to prevent back-navigation
    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);
  };

  // Token invalid / expired view
  if (tokenInvalid) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1A1B1E" }}>
        <Card className="w-full max-w-sm border-border bg-card text-center">
          <CardHeader><CardTitle className="text-xl font-bold">Reset Link Invalid</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link has already been used or has expired. Password reset links are valid for 30 minutes only.
            </p>
            <Button variant="outline" onClick={() => {
              setTokenInvalid(false);
              setIsRecovery(false);
              // Clear hash
              window.history.replaceState(null, "", window.location.pathname);
            }} className="rounded-btn">Request a New Reset Link</Button>
            <div>
              <button type="button" onClick={() => navigate("/login", { replace: true })} className="text-sm text-muted-foreground hover:text-foreground underline">Back to login</button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset complete — show success briefly
  if (resetComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1A1B1E" }}>
        <Card className="w-full max-w-sm border-border bg-card text-center">
          <CardHeader><CardTitle className="text-xl font-bold">Password Reset Successful</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Your password has been reset successfully. Redirecting to login…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sent && !isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1A1B1E" }}>
        <Card className="w-full max-w-sm border-border bg-card text-center">
          <CardHeader><CardTitle className="text-xl font-bold">Email Sent</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">If an account exists for <strong>{email}</strong>, you'll receive a password reset link.</p>
            <Button variant="outline" onClick={() => navigate("/login")} className="rounded-btn">Back to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1A1B1E" }}>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">{isRecovery ? "Create New Password" : "Reset Password"}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{isRecovery ? "Enter your new password to finish recovery" : "Enter your email to receive a reset link"}</p>
        </CardHeader>
        <CardContent>
          {isRecovery ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <PasswordInput id="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required showStrength />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <PasswordInput id="confirm" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? "Updating…" : "Update Password"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => navigate("/login")} className="text-sm text-muted-foreground hover:text-foreground underline">Back to login</button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
