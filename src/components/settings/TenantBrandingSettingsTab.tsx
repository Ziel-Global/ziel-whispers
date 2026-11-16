import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Sparkles,
  Loader2,
  Building2,
  Eye,
  Trash2,
} from "lucide-react";
import { hexToHsl, normalizeHsl, applyTenantTheme } from "@/lib/tenantTheme";

const COLOR_PRESETS = [
  { name: "Ziel Orange", primaryHsl: "17 84% 52%", hex: "#EB5A1E", secondaryHsl: "40 8% 96%" },
  { name: "Ocean Blue", primaryHsl: "217 91% 60%", hex: "#2563EB", secondaryHsl: "214 32% 96%" },
  { name: "Emerald", primaryHsl: "160 84% 39%", hex: "#059669", secondaryHsl: "140 20% 96%" },
  { name: "Royal Purple", primaryHsl: "262 83% 58%", hex: "#7C3AED", secondaryHsl: "260 20% 96%" },
  { name: "Crimson Rose", primaryHsl: "346 84% 61%", hex: "#E11D48", secondaryHsl: "340 20% 96%" },
  { name: "Slate Charcoal", primaryHsl: "222 47% 20%", hex: "#1E293B", secondaryHsl: "210 20% 96%" },
  { name: "Teal Modern", primaryHsl: "174 86% 32%", hex: "#0D9488", secondaryHsl: "170 20% 96%" },
];

export function TenantBrandingSettingsTab() {
  const { profile, tenant, branding, refreshTenantBranding } = useAuth();

  const [appName, setAppName] = useState(branding?.appName || tenant?.name || "Ziel Whispers");
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl || "");
  const [faviconUrl, setFaviconUrl] = useState(branding?.faviconUrl || "");
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor || "17 84% 52%");
  const [secondaryColor, setSecondaryColor] = useState(branding?.secondaryColor || "40 8% 96%");

  const [customHex, setCustomHex] = useState("#EB5A1E");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (branding) {
      setAppName(branding.appName || tenant?.name || "Ziel Whispers");
      setLogoUrl(branding.logoUrl || "");
      setFaviconUrl(branding.faviconUrl || "");
      setPrimaryColor(branding.primaryColor || "17 84% 52%");
      setSecondaryColor(branding.secondaryColor || "40 8% 96%");
    }
  }, [branding, tenant]);

  const handleApplyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primaryHsl);
    setSecondaryColor(preset.secondaryHsl);
    setCustomHex(preset.hex);
    // Instant live preview
    applyTenantTheme({
      appName,
      primaryColor: preset.primaryHsl,
      secondaryColor: preset.secondaryHsl,
    });
  };

  const handleCustomHexChange = (hexVal: string) => {
    setCustomHex(hexVal);
    const converted = hexToHsl(hexVal);
    if (converted) {
      setPrimaryColor(converted);
      applyTenantTheme({
        appName,
        primaryColor: converted,
        secondaryColor,
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    const tenantId = profile?.tenant_id || tenant?.id;
    if (!tenantId) {
      toast.error("No active tenant context found for upload");
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `${tenantId}/logo_${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("tenant-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("tenant-assets")
        .getPublicUrl(data.path);

      setLogoUrl(publicUrlData.publicUrl);
      toast.success("Logo uploaded successfully! Click 'Save Branding' to persist.");
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Failed to upload logo image");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    const tenantId = profile?.tenant_id || tenant?.id;
    if (!tenantId) {
      toast.error("Cannot save: Missing tenant workspace identifier");
      return;
    }

    setSaving(true);
    try {
      const normalizedPrimary = normalizeHsl(primaryColor);
      const normalizedSecondary = normalizeHsl(secondaryColor);

      const { error } = await (supabase as any)
        .from("tenant_branding")
        .upsert(
          {
            tenant_id: tenantId,
            app_name: appName.trim() || tenant?.name || "Ziel Whispers",
            logo_url: logoUrl.trim() || null,
            favicon_url: faviconUrl.trim() || null,
            primary_color: normalizedPrimary,
            secondary_color: normalizedSecondary,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      if (error) throw error;

      await refreshTenantBranding();
      toast.success("Branding preferences saved and applied!");
    } catch (err: any) {
      console.error("Save branding error:", err);
      toast.error(err.message || "Failed to save branding preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    handleApplyPreset(COLOR_PRESETS[0]);
    setLogoUrl("");
    setFaviconUrl("");
    setAppName(tenant?.name || "Ziel Whispers");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Overview Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Workspace Branding & White-Label</CardTitle>
                <CardDescription className="text-xs">
                  Customize the appearance, logo, and color identity of your organization's workspace.
                </CardDescription>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 text-xs h-9 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving Changes..." : "Save Branding"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Identity Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Workspace Identity
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-app-name" className="text-xs font-medium">
                  Application Display Name
                </Label>
                <Input
                  id="brand-app-name"
                  value={appName}
                  onChange={(e) => {
                    setAppName(e.target.value);
                    applyTenantTheme({ appName: e.target.value });
                  }}
                  placeholder="e.g. Acme Hub"
                  className="text-xs h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown in page headers, browser tab titles, and notifications.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Workspace Slug Identifier</Label>
                <Input
                  value={tenant?.slug || "default"}
                  disabled
                  className="text-xs h-9 font-mono bg-muted/50 cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground">
                  Assigned workspace key: <span className="font-mono">/{tenant?.slug}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Logo Section */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Workspace Logo
            </h4>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border bg-muted/20">
              {/* Preview Box */}
              <div className="w-20 h-20 rounded-xl border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="w-full h-full bg-[#17171A] flex items-center justify-center text-white font-extrabold text-xl">
                    {(appName || "Zi").slice(0, 2)}
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="text-xs gap-1.5 h-8"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {uploadingLogo ? "Uploading..." : "Upload Custom Logo"}
                  </Button>

                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl("")}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Logo
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Recommended size: 256x256px or horizontal vector logo. Max size 5MB. Stored securely in your isolated workspace storage.
                </p>
              </div>
            </div>
          </div>

          {/* Theme & Palette Section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Brand Colors & Theme
              </h4>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </Button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = primaryColor === preset.primaryHsl;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full shrink-0 shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate font-medium">{preset.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Pickers */}
            <div className="p-4 rounded-xl border bg-muted/20 mt-3 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Custom Primary Brand Color</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Sets button fills, active navigation highlights, and key metric indicators.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border p-0.5 bg-white"
                  />
                  <Input
                    value={customHex}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    placeholder="#EB5A1E"
                    className="w-28 text-xs font-mono h-8 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Component Preview */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Component Live Preview
            </h4>

            <div className="p-5 rounded-xl border bg-neutral-900 text-white space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button className="h-8 text-xs shadow-md">
                  Primary Action Button
                </Button>
                <Button variant="outline" className="h-8 text-xs text-white border-white/20 hover:bg-white/10 hover:text-white">
                  Secondary Action
                </Button>
                <Badge className="bg-primary text-primary-foreground font-semibold px-2 py-0.5 text-xs">
                  Active Status
                </Badge>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                  {appName.slice(0, 2)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {appName}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Live UI Preview with Active Brand Token
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

