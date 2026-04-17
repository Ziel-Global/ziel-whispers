import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import zielLogoWhite from "@/assets/ziel-logo-white.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: lockData } = await supabase.functions.invoke("log-login-attempt", {
      body: { action: "check", email },
    });

    if (lockData?.locked) {
      toast.error("Your account has been locked due to too many failed attempts. Please try again in 15 minutes.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      await supabase.functions.invoke("log-login-attempt", {
        body: { action: "record", email, success: false },
      });
      toast.error(error.message);
      setLoading(false);
      return;
    }

    await supabase.functions.invoke("log-login-attempt", {
      body: { action: "record", email, success: true },
    });

    if (data.user) {
      await supabase.from("audit_logs").insert({
        actor_id: data.user.id,
        action: "session.login",
        target_entity: "users",
        target_id: data.user.id,
      });
    }
    setLoading(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#1A1B1E" }}>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="text-center">
          <img src={zielLogoWhite} alt="Ziel" className="h-10 mx-auto" />
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/reset-password")}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
