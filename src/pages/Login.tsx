import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import zielLogoWhite from "@/assets/ziel-logo-black.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailError("");
    setPasswordError("");

    // Validate email format
    if (!email.trim()) {
      setEmailError("Email is invalid");
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Email is invalid");
      setLoading(false);
      return;
    }

    // Validate password
    if (!password) {
      setPasswordError("Password is invalid");
      setLoading(false);
      return;
    }

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
      
      // Determine if error is related to email or password
      const errorMessage = error.message.toLowerCase();
      
      // If it's a generic "invalid credentials" error, differentiate based on context
      if (errorMessage.includes("invalid login credentials") || errorMessage.includes("invalid credentials")) {
        // Try to check if user exists via the function
        let userExists = false;
        try {
          const { data: checkData, error: checkError } = await supabase.functions.invoke("check-user-exists", {
            body: { email },
          });
          
          userExists = !checkError && checkData?.exists;
        } catch (e) {
          // Function call failed, will use default logic below
        }
        
        if (userExists) {
          // User exists, so password must be wrong
          setPasswordError("Password invalid");
        } else {
          // Assume password is wrong for properly formatted emails (safer assumption)
          // If it's actually the email, user will need to check email format separately
          setPasswordError("Password invalid");
        }
      } else if (errorMessage.includes("user") || errorMessage.includes("email")) {
        setEmailError("Email is invalid");
      } else if (errorMessage.includes("password")) {
        setPasswordError("Password invalid");
      } else {
        toast.error(error.message);
      }
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
              disabled={loading}
              className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
