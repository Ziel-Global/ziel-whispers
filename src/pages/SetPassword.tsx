import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordInput } from "@/components/ui/password-input";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!/[0-9]/.test(password)) { toast.error("Password must contain at least one number"); return; }
    if (!/[^a-zA-Z0-9]/.test(password)) { toast.error("Password must contain at least one special character"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      if (profile) {
        const [{ error: profileError }, { error: auditError }] = await Promise.all([
          supabase.from("users").update({ must_change_password: false }).eq("id", profile.id),
          supabase.from("audit_logs").insert({
            actor_id: profile.id,
            action: "user.password_set",
            target_entity: "users",
            target_id: profile.id,
          }),
        ]);

        if (profileError) throw profileError;
        if (auditError) throw auditError;
      }

      await signOut();
      toast.success("Password changed successfully. Please log in with your new password.");
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1A1B1E" }}>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">Set Your Password</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Please choose a new password to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput id="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required showStrength />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <PasswordInput id="confirm" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Updating…" : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
