import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Building2,
  Copy,
  Users,
  Mail,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Palette,
  ExternalLink,
} from "lucide-react";

export interface TenantDetails {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial" | "archived";
  created_at: string;
  app_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  total_users: number;
  active_users: number;
  admin_email: string | null;
  admin_name: string | null;
}

interface InspectTenantModalProps {
  tenant: TenantDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleStatus?: (tenantId: string, currentStatus: string) => void;
}

export function InspectTenantModal({
  tenant,
  open,
  onOpenChange,
  onToggleStatus,
}: InspectTenantModalProps) {
  if (!tenant) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const isSuspended = tenant.status === "suspended";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-3">
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="w-10 h-10 rounded-lg object-contain border bg-white p-1"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-base">
                  {tenant.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <DialogTitle className="text-xl font-bold">{tenant.name}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  slug: /{tenant.slug}
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={
                tenant.status === "active"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : tenant.status === "suspended"
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
              }
            >
              {tenant.status.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Identity & Technical IDs */}
          <div className="bg-muted/40 rounded-lg p-3.5 border space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tenant UUID:</span>
              <button
                type="button"
                onClick={() => handleCopy(tenant.id, "Tenant UUID")}
                className="font-mono text-foreground hover:text-primary flex items-center gap-1 transition-colors"
                title="Click to copy"
              >
                <span>{tenant.id}</span>
                <Copy className="w-3 h-3 ml-0.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>Created On:</span>
              <span className="text-foreground font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                {tenant.created_at
                  ? format(new Date(tenant.created_at), "PPP p")
                  : "—"}
              </span>
            </div>
          </div>

          {/* Primary Administrator */}
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" /> Primary Tenant Admin
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground block">Full Name:</span>
                <span className="font-medium text-foreground">
                  {tenant.admin_name || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Email Address:</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3 text-muted-foreground" />
                  {tenant.admin_email || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* User Headcount & Capacity */}
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" /> Headcount & Capacity
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs pt-1">
              <div className="bg-background rounded-md p-2.5 border">
                <span className="text-muted-foreground block">Total Accounts:</span>
                <span className="text-lg font-bold text-foreground">
                  {tenant.total_users || 0}
                </span>
              </div>
              <div className="bg-background rounded-md p-2.5 border">
                <span className="text-muted-foreground block">Active Members:</span>
                <span className="text-lg font-bold text-emerald-600">
                  {tenant.active_users || 0}
                </span>
              </div>
            </div>
          </div>

          {/* White-Label Branding Configuration */}
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-primary" /> White-Label Branding
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-muted-foreground block">Custom App Title:</span>
                <span className="font-medium text-foreground">
                  {tenant.app_name || tenant.name}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block mb-1">Color Palette:</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full border shadow-xs"
                      style={{ backgroundColor: tenant.primary_color || "#EB5A1E" }}
                    />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {tenant.primary_color || "Default"}
                    </span>
                  </div>
                  {tenant.secondary_color && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full border shadow-xs"
                        style={{ backgroundColor: tenant.secondary_color }}
                      />
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {tenant.secondary_color}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t mt-2">
          {onToggleStatus && (
            <Button
              variant={isSuspended ? "default" : "destructive"}
              size="sm"
              onClick={() => onToggleStatus(tenant.id, tenant.status)}
              className="text-xs gap-1.5"
            >
              {isSuspended ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" /> Reactivate Workspace
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Suspend Workspace
                </>
              )}
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

