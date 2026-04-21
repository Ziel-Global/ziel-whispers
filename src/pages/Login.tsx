import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import zielLogoWhite from "@/assets/ziel-logo-black.png";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Database, AlertCircle, CheckCircleConfig } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "failed">("checking");

  useEffect(() => {
    const checkConn = async () => {
      try {
        const { error } = await supabase.from("system_settings").select("key").limit(1);
        if (error) {
           console.error("DB Connection Error:", error);
           setDbStatus("failed");
        } else {
           setDbStatus("connected");
        }
      } catch (err) {
        console.error("DB Connection Exception:", err);
        setDbStatus("failed");
      }
    };
    checkConn();
  }, []);

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
                type="text"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                className={emailError ? "!border-red-500" : ""}
              />
              {emailError && <p className="text-sm text-red-500 font-medium">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                className={passwordError ? "!border-red-500" : ""}
              />
              {passwordError && <p className="text-sm text-red-500 font-medium">{passwordError}</p>}
            </div>
            <Button
              type="submit"
              disabled={loading || dbStatus === "failed"}
              className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Database Status:</span>
            {dbStatus === "checking" && <span className="animate-pulse text-yellow-500">Checking…</span>}
            {dbStatus === "connected" && (
              <span className="flex items-center gap-1 text-green-500 font-medium">
                <Database className="h-3 w-3" /> Linked
              </span>
            )}
            {dbStatus === "failed" && (
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <AlertCircle className="h-3 w-3" /> Connection Failed
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
