import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface AssignSSAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AssignSSAModal({
  open,
  onOpenChange,
  onSuccess,
}: AssignSSAModalProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [role, setRole] = useState<"Master_SSA" | "Provisioning_SSA" | "Support_SSA">("Provisioning_SSA");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetUserId.trim()) {
      toast.error("Please enter the user's UUID or email");
      return;
    }

    setLoading(true);

    try {
      let resolvedUserId = targetUserId.trim();

      // If user typed an email, look up their ID in public.users
      if (resolvedUserId.includes("@")) {
        const { data: userLookup, error: lookupErr } = await supabase
          .from("users")
          .select("id")
          .eq("email", resolvedUserId.toLowerCase())
          .maybeSingle();

        if (lookupErr || !userLookup?.id) {
          throw new Error("No user registered with that email address");
        }
        resolvedUserId = userLookup.id;
      }

      // Call assign_platform_role RPC
      const { error: assignErr } = await (supabase as any).rpc("assign_platform_role", {
        p_user_id: resolvedUserId,
        p_role: role,
      });

      if (assignErr) {
        throw new Error(assignErr.message || "Failed to assign platform role");
      }

      toast.success(`Platform role "${role}" successfully assigned!`);
      setTargetUserId("");
      setRole("Provisioning_SSA");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("SSA Assignment Error:", err);
      toast.error(err.message || "Failed to assign role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Assign Platform Admin</DialogTitle>
              <DialogDescription>
                Delegate system-level administrative privileges across all workspaces.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="target-user" className="text-xs font-medium">
              Target User (Email or UUID) *
            </Label>
            <Input
              id="target-user"
              placeholder="e.g. operator@ziel.com or 550e8400-e29b..."
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Platform Authority Level *</Label>
            <Select
              value={role}
              onValueChange={(val: any) => setRole(val)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select platform role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Master_SSA">
                  Master SSA (Full Platform Control)
                </SelectItem>
                <SelectItem value="Provisioning_SSA">
                  Provisioning SSA (Workspace Onboarding)
                </SelectItem>
                <SelectItem value="Support_SSA">
                  Support SSA (Read-Only Troubleshooting)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Permission Summary:</p>
            {role === "Master_SSA" && (
              <p>Can create, suspend, archive, and delete tenants; manage branding; and assign or revoke other platform admins.</p>
            )}
            {role === "Provisioning_SSA" && (
              <p>Can provision new workspaces, configure initial admin credentials, and apply custom branding templates.</p>
            )}
            {role === "Support_SSA" && (
              <p>Can inspect tenant telemetries and workspace configs in read-only mode for technical troubleshooting.</p>
            )}
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
              {loading ? "Assigning..." : "Assign Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

