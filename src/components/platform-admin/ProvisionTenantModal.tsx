import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { Loader2, Sparkles, Building2, User, Key, Palette } from "lucide-react";

interface ProvisionTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const COLOR_PRESETS = [
  { name: "Ziel Orange", primary: "17 84% 52%", secondary: "40 8% 96%", hex: "#EB5A1E" },
  { name: "Ocean Blue", primary: "217 91% 60%", secondary: "214 32% 96%", hex: "#2563EB" },
  { name: "Emerald Green", primary: "160 84% 39%", secondary: "140 20% 96%", hex: "#059669" },
  { name: "Royal Purple", primary: "262 83% 58%", secondary: "260 20% 96%", hex: "#7C3AED" },
  { name: "Crimson Rose", primary: "346 84% 61%", secondary: "340 20% 96%", hex: "#E11D48" },
  { name: "Dark Slate", primary: "222 47% 20%", secondary: "210 20% 96%", hex: "#1E293B" },
];

export function ProvisionTenantModal({
  open,
  onOpenChange,
  onSuccess,
}: ProvisionTenantModalProps) {
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [primaryColor, setPrimaryColor] = useState("17 84% 52%");
  const [secondaryColor, setSecondaryColor] = useState("40 8% 96%");
  const [loading, setLoading] = useState(false);

  const handleNameChange = (val: string) => {
    setTenantName(val);
    if (!isSlugManual) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generated);
    }
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 14; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminPassword(pwd);
  };

  const handleApplyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantName.trim()) {
      toast.error("Please provide a tenant workspace name");
      return;
    }
    if (!slug.trim()) {
      toast.error("Please provide a unique workspace slug");
      return;
    }
    if (!adminFullName.trim() || !adminEmail.trim()) {
      toast.error("Please provide the administrator's name and email");
      return;
    }
    if (!adminPassword || adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const { data: existingTenant } = await (supabase as any)
        .from("tenants")
        .select("id")
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (existingTenant) {
        throw new Error(`Tenant with slug "${cleanSlug}" already exists.`);
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // 1. Create Supabase Auth user using ephemeral client so SSA session remains active
      const ephemeralClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: authData, error: authError } = await ephemeralClient.auth.signUp({
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
        options: {
          data: {
            full_name: adminFullName.trim(),
            role: "admin",
            user_type: "tenant_admin",
          },
        },
      });

      if (authError || !authData.user?.id) {
        throw new Error(authError?.message || "Failed to create administrator account");
      }

      const adminUserId = authData.user.id;

      // 2. Call the Atomic Provisioning RPC
      const { data: newTenantId, error: rpcError } = await (supabase as any).rpc(
        "provision_tenant_workspace",
        {
          p_tenant_name: tenantName.trim(),
          p_tenant_slug: slug.trim().toLowerCase(),
          p_admin_user_id: adminUserId,
          p_admin_email: adminEmail.trim().toLowerCase(),
          p_admin_full_name: adminFullName.trim(),
          p_primary_color: primaryColor,
          p_secondary_color: secondaryColor,
          p_logo_url: null,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to provision workspace database");
      }

      toast.success(
        `Workspace "${tenantName}" successfully provisioned! Tenant ID: ${newTenantId.slice(0, 8)}...`
      );

      // Reset form
      setTenantName("");
      setSlug("");
      setIsSlugManual(false);
      setAdminFullName("");
      setAdminEmail("");
      setAdminPassword("");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Provisioning error:", err);
      toast.error(err.message || "Failed to provision tenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Provision New Workspace</DialogTitle>
              <DialogDescription>
                Bootstrap a fully isolated tenant instance with initial administrator & settings.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Workspace Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Workspace Profile
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-name" className="text-xs font-medium">
                  Workspace / Organization Name *
                </Label>
                <Input
                  id="tenant-name"
                  placeholder="e.g. Apex Global Corp"
                  value={tenantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-slug" className="text-xs font-medium">
                  Unique Slug Identifier *
                </Label>
                <Input
                  id="tenant-slug"
                  placeholder="e.g. apex-global"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setIsSlugManual(true);
                  }}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </div>

          {/* Admin Account */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Default Tenant Administrator
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name" className="text-xs font-medium">
                  Administrator Full Name *
                </Label>
                <Input
                  id="admin-name"
                  placeholder="e.g. Sarah Jenkins"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-medium">
                  Administrator Email *
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="e.g. sarah@apex.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-pwd" className="text-xs font-medium flex items-center gap-1">
                  <Key className="w-3 h-3 text-muted-foreground" /> Initial Password *
                </Label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3" /> Generate Secure Password
                </button>
              </div>
              <PasswordInput
                id="admin-pwd"
                placeholder="At least 8 characters"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* White-Label Branding Presets */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Theme & Branding Preset
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = primaryColor === preset.primary;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span className="truncate font-medium">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Provisioning Workspace..." : "Create Tenant Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

