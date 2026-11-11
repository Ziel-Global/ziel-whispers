import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Plus,
  Users,
  Trash2,
  RotateCw,
} from "lucide-react";
import { AssignSSAModal } from "@/components/platform-admin/AssignSSAModal";

interface PlatformRoleItem {
  id: string;
  user_id: string;
  role: "Master_SSA" | "Provisioning_SSA" | "Support_SSA";
  created_at: string;
  granted_by: string | null;
  user?: {
    email: string;
    full_name: string;
  };
}

export default function PlatformAdminsPage() {
  const { user, platformRole, isSSA } = useAuth();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);

  // Fetch Platform Roles (SSAs)
  const {
    data: platformAdmins = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<PlatformRoleItem[]>({
    queryKey: ["platform-admins-list"],
    queryFn: async () => {
      const { data: rolesData, error: rolesErr } = await (supabase as any)
        .from("platform_roles")
        .select("id, user_id, role, created_at, granted_by");

      if (rolesErr) throw rolesErr;
      if (!rolesData || rolesData.length === 0) return [];

      const userIds = rolesData.map((r: any) => r.user_id);
      const { data: usersData } = await supabase
        .from("users")
        .select("id, email, full_name")
        .in("id", userIds);

      const userMap = new Map((usersData || []).map((u) => [u.id, u]));

      return rolesData.map((r: any) => ({
        ...r,
        user: userMap.get(r.user_id),
      }));
    },
    enabled: isSSA,
  });

  // Revoke SSA Mutation
  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any).rpc("revoke_platform_role", {
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Platform admin privileges revoked");
      queryClient.invalidateQueries({ queryKey: ["platform-admins-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke platform role");
    },
  });

  const handleRevoke = (userId: string, email: string) => {
    if (confirm(`Are you sure you want to revoke platform admin privileges for ${email}?`)) {
      revokeMutation.mutate(userId);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            SSA Sub-Admins & Operators
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage authorized platform operators, provisioning admins, and delegated security personnel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5 text-xs h-9"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {platformRole === "Master_SSA" && (
            <Button
              size="sm"
              onClick={() => setAssignOpen(true)}
              className="gap-1.5 text-xs h-9 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Assign Sub-Admin
            </Button>
          )}
        </div>
      </div>

      {/* Roles Legend / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2">
            <Badge variant="outline" className="w-fit bg-rose-500/10 text-rose-600 border-rose-500/30 font-semibold text-xs mb-1">
              Master SSA
            </Badge>
            <CardTitle className="text-sm font-bold">Platform Owner</CardTitle>
            <CardDescription className="text-xs">
              Full control: tenant provisioning, status locking, and SSA role delegation.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2">
            <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30 font-semibold text-xs mb-1">
              Provisioning SSA
            </Badge>
            <CardTitle className="text-sm font-bold">Onboarding Admin</CardTitle>
            <CardDescription className="text-xs">
              Can create and configure new corporate tenant workspaces.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="pb-2">
            <Badge variant="outline" className="w-fit bg-blue-500/10 text-blue-600 border-blue-500/30 font-semibold text-xs mb-1">
              Support SSA
            </Badge>
            <CardTitle className="text-sm font-bold">Operational Support</CardTitle>
            <CardDescription className="text-xs">
              Read-only oversight across multi-tenant telemetry and diagnostics.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Operators List Table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Active Platform Operators
          </CardTitle>
          <CardDescription className="text-xs">
            Users authorized with cross-workspace platform security credentials.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold">Operator Name & Email</TableHead>
                <TableHead className="text-xs font-semibold">Assigned SSA Role</TableHead>
                <TableHead className="text-xs font-semibold">Granted Date</TableHead>
                {platformRole === "Master_SSA" && (
                  <TableHead className="text-xs font-semibold text-right pr-6">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                    Loading platform operators...
                  </TableCell>
                </TableRow>
              ) : platformAdmins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                    No sub-administrators assigned yet.
                  </TableCell>
                </TableRow>
              ) : (
                platformAdmins.map((admin) => {
                  const isCurrent = admin.user_id === user?.id;
                  return (
                    <TableRow key={admin.id} className="hover:bg-muted/20">
                      <TableCell className="py-3">
                        <div className="font-semibold text-xs md:text-sm text-foreground">
                          {admin.user?.full_name || "Platform Admin"}
                          {isCurrent && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {admin.user?.email || admin.user_id}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            admin.role === "Master_SSA"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/30 text-xs"
                              : admin.role === "Provisioning_SSA"
                              ? "bg-primary/10 text-primary border-primary/30 text-xs"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs"
                          }
                        >
                          <ShieldCheck className="w-3 h-3 mr-1 inline" />
                          {admin.role.replace("_", " ")}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {admin.created_at ? format(new Date(admin.created_at), "dd-MMM-yyyy") : "—"}
                      </TableCell>

                      {platformRole === "Master_SSA" && (
                        <TableCell className="text-right pr-6">
                          {!isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(admin.user_id, admin.user?.email || "this user")}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2 gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Revoke Role
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AssignSSAModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

