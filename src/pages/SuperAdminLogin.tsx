import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import zielLogoWhite from "@/assets/ziel-logo-black.png";
import { ArrowLeft, RotateCw } from "lucide-react";

interface PendingOtp {
  code: string;
  expiresAt: number;
  user: any;
  role: string;
  attempts: number;
}

export default function SuperAdminLoginPage() {
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Handle countdown timers when on OTP step
  useEffect(() => {
    if (step === "otp") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [step]);

  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      };
    }
  }, [resendCooldown]);

  const sendOtpEmail = async (targetEmail: string, code: string): Promise<boolean> => {
    try {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="font-size:20px;color:#1A1B1E;margin:0 0 12px 0;">Ziel Cloud Security</h2>
          <p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 20px 0;">
            A sign-in request was received for your <strong>Platform Super Admin</strong> account.
            Please use the one-time verification code below to complete your sign-in:
          </p>
          <div style="text-align:center;margin:24px 0;padding:18px;background:#F9FAFB;border-radius:10px;border:1px dashed #D1D5DB;">
            <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#EB5A1E;font-family:monospace;">${code}</span>
          </div>
          <p style="color:#6B7280;font-size:12.5px;line-height:1.5;margin:20px 0 0 0;">
            This code will expire in <strong>10 minutes</strong>. If you did not initiate this login attempt, please secure your account immediately.
          </p>
        </div>
      `;

      if (import.meta.env.DEV) {
        console.log(`[Platform Super Admin OTP]: ${code}`);
      }

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: targetEmail,
          subject: `${code} is your Platform Super Admin verification code`,
          html,
          fromName: "Ziel Cloud Security",
          fromEmail: "noreply@zielglobal.com",
        },
      });

      if (error || (data && data.ok === false)) {
        console.warn("send-email notice:", error || data?.error);
      }
      return true;
    } catch (err) {
      console.error("Failed to dispatch OTP email:", err);
      return false;
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");

    if (!email.trim()) {
      setEmailError("Please enter your email");
      return;
    }
    if (!password) {
      setPasswordError("Please enter your password");
      return;
    }

    setLoading(true);

    try {
      // 1. Lockout check
      const { data: lockData } = await supabase.functions.invoke("log-login-attempt", {
        body: { action: "check", email },
      });

      if (lockData?.locked) {
        toast.error("Your account has been locked due to too many failed attempts. Please try again in 15 minutes.");
        setLoading(false);
        return;
      }

      // 2. Validate credentials
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        await supabase.functions.invoke("log-login-attempt", {
          body: { action: "record", email, success: false },
        });
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast.error("Authentication failed");
        setLoading(false);
        return;
      }

      // 3. Confirm Platform Super Admin Role
      const { data: ssaData, error: ssaErr } = await (supabase as any)
        .from("platform_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (ssaErr || !ssaData?.role) {
        await supabase.functions.invoke("log-login-attempt", {
          body: { action: "record", email, success: false },
        });
        await supabase.auth.signOut();
        toast.error("Access Denied: This account is not a registered Platform Super Admin.");
        setLoading(false);
        return;
      }

      // 4. Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await sendOtpEmail(email.trim(), code);

      setPendingOtp({
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        user: data.user,
        role: ssaData.role,
        attempts: 0,
      });

      setResendCooldown(60);
      setTimeLeft(600);
      setStep("otp");
      toast.success("Verification code sent to your email");
    } catch (err: any) {
      console.error("Super Admin Login error:", err);
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");

    if (!pendingOtp) {
      toast.error("Verification session expired. Please sign in again.");
      setStep("credentials");
      return;
    }

    if (!otp.trim() || otp.trim().length !== 6) {
      setOtpError("Please enter the 6-digit verification code");
      return;
    }

    if (Date.now() > pendingOtp.expiresAt) {
      setOtpError("This code has expired. Please request a new code.");
      return;
    }

    if (pendingOtp.attempts >= 5) {
      toast.error("Too many incorrect attempts. Please sign in again.");
      await supabase.auth.signOut();
      setPendingOtp(null);
      setStep("credentials");
      return;
    }

    setLoading(true);

    if (otp.trim() !== pendingOtp.code) {
      setPendingOtp((prev) => (prev ? { ...prev, attempts: prev.attempts + 1 } : null));
      setOtpError("Invalid verification code. Please check your email and try again.");
      setLoading(false);
      return;
    }

    try {
      // Mark OTP verified in session storage
      sessionStorage.setItem("ziel_ssa_otp_verified", "true");

      // Record successful login in audit log
      await supabase.functions.invoke("log-login-attempt", {
        body: { action: "record", email, success: true },
      });

      await supabase.from("audit_logs").insert({
        actor_id: pendingOtp.user.id,
        action: "session.login",
        target_entity: "users",
        target_id: pendingOtp.user.id,
        metadata: { portal: "super-admin", role: pendingOtp.role, mfa: "email_otp", verified: true },
      });

      toast.success("Verification successful");
      navigate("/super-admin/dashboard", { replace: true });
    } catch (err: any) {
      console.error("OTP verification error:", err);
      toast.error(err.message || "Failed to finalize verification");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !pendingOtp) return;

    setLoading(true);
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await sendOtpEmail(email.trim(), newCode);

    setPendingOtp((prev) =>
      prev
        ? {
            ...prev,
            code: newCode,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
          }
        : null
    );

    setResendCooldown(60);
    setTimeLeft(600);
    setOtp("");
    setOtpError("");
    setLoading(false);
    toast.success("A new verification code has been sent");
  };

  const handleBackToCredentials = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("ziel_ssa_otp_verified");
    setPendingOtp(null);
    setOtp("");
    setOtpError("");
    setStep("credentials");
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: "#1A1B1E" }}>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="text-center pb-2">
          <img src={zielLogoWhite} alt="Ziel" className="h-10 mx-auto" />
          <p className="text-sm text-muted-foreground mt-1">
            {step === "credentials" ? "Sign in to your account" : "Two-Step Verification"}
          </p>
        </CardHeader>

        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
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
                {loading ? "Verifying credentials…" : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-xs text-muted-foreground text-center">
                We sent a 6-digit verification code to <span className="font-semibold text-foreground">{email}</span>.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="otp">Verification Code</Label>
                  <span className="text-muted-foreground font-mono">{formatTimer(timeLeft)}</span>
                </div>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  autoFocus
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                    setOtpError("");
                  }}
                  className={`text-center font-mono text-xl tracking-[0.35em] font-bold h-12 ${
                    otpError ? "!border-red-500" : ""
                  }`}
                />
                {otpError && <p className="text-xs text-red-500 font-medium text-center">{otpError}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6 || timeLeft === 0}
                className="w-full rounded-btn bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? "Verifying code…" : "Verify & Sign In"}
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className={`flex items-center gap-1 font-medium transition-colors ${
                    resendCooldown > 0
                      ? "text-muted-foreground cursor-not-allowed opacity-60"
                      : "text-primary hover:underline cursor-pointer"
                  }`}
                >
                  <RotateCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
