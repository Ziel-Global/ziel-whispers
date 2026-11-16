import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { TruncatedTitle } from "@/components/ui/truncated-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Copy,
  ExternalLink,
  Sparkles,
  Loader2,
  Trash2,
} from "lucide-react";
import { ProvisionTenantModal } from "@/components/platform-admin/ProvisionTenantModal";
import { AssignSSAModal } from "@/components/platform-admin/AssignSSAModal";

interface TenantOverviewItem {
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

export default function PlatformAdminPage() {
  const { user, profile, platformRole, isSSA } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "tenants";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  // 1. Fetch Tenants Overview
  const {
    data: tenants = [],
    isLoading: loadingTenants,
    refetch: refetchTenants,
  } = useQuery<TenantOverviewItem[]>({
    queryKey: ["tenants-overview"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tenants_overview");
      if (error) throw error;
      return data || [];
    },
    enabled: isSSA,
  });

  // 2. Fetch Platform Roles (SSAs)
  const {
    data: platformAdmins = [],
    isLoading: loadingAdmins,
    refetch: refetchAdmins,
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
    enabled: isSSA && platformRole === "Master_SSA",
  });

  // Status Change Mutation
  const statusMutation = useMutation({
    mutationFn: async ({
      tenantId,
      newStatus,
    }: {
      tenantId: string;
      newStatus: "active" | "suspended" | "trial" | "archived";
    }) => {
      const { error } = await (supabase as any).rpc("set_tenant_status", {
        p_tenant_id: tenantId,
        p_status: newStatus,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Workspace status updated to "${vars.newStatus}"`);
      queryClient.invalidateQueries({ queryKey: ["tenants-overview"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update workspace status");
    },
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

  // One-time First Master SSA Claim
  const handleBootstrapMaster = async () => {
    if (!user?.id) return;
    setBootstrapping(true);
    try {
      const { error } = await (supabase as any).rpc("bootstrap_first_master_ssa", {
        p_user_id: user.id,
      });
      if (error) throw error;
      toast.success("Congratulations! You are now the Master SSA of the platform.");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to bootstrap Master SSA");
    } finally {
      setBootstrapping(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Tenant ID copied to clipboard");
  };

  // Filtered Tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase()) ||
        (t.admin_email && t.admin_email.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tenants, search, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === "active").length;
    const suspended = tenants.filter((t) => t.status === "suspended").length;
    const totalUsers = tenants.reduce((acc, t) => acc + Number(t.total_users || 0), 0);
    return { total, active, suspended, totalUsers };
  }, [tenants]);

  // Render Bootstrap Screen if user is an admin but no SSA has been claimed yet
  if (!isSSA) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Platform Administration Console"
          subtitle="Multi-Tenant Master Oversight & Provisioning"
        />

        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Claim Master SSA Privileges</CardTitle>
                <CardDescription>
                  This platform requires an initial master administrator to bootstrap tenant management.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              As an authenticated system administrator, you can claim the root{" "}
              <strong className="text-foreground">Master_SSA</strong> role. This one-time action unlocks
              workspace provisioning, global tenant lifecycle management, and sub-admin delegation.
            </p>

            <Button
              onClick={handleBootstrapMaster}
              disabled={bootstrapping}
              className="gap-2"
              size="lg"
            >
              {bootstrapping && <Loader2 className="w-4 h-4 animate-spin" />}
              {bootstrapping ? "Claiming Master Authority..." : "Claim Master SSA Role"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Platform Administration
            </h1>
            <Badge
              variant="outline"
              className={`font-semibold px-2.5 py-0.5 text-xs ${
                platformRole === "Master_SSA"
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                  : platformRole === "Provisioning_SSA"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-blue-500/10 text-blue-600 border-blue-500/30"
              }`}
            >
              <ShieldCheck className="w-3 h-3 mr-1 inline" />
              {platformRole?.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Master control room for tenant workspaces, isolation policies, and platform operators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {platformRole === "Master_SSA" && (
            <Button
              variant="outline"
              onClick={() => setAssignOpen(true)}
              className="gap-1.5 text-xs h-9"
            >
              <Shield className="w-3.5 h-3.5" />
              Manage SSAs
            </Button>
          )}

          {(platformRole === "Master_SSA" || platformRole === "Provisioning_SSA") && (
            <Button
              onClick={() => setProvisionOpen(true)}
              className="gap-1.5 text-xs h-9 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Provision Workspace
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Workspaces
            </CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered tenant environments</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Workspaces
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{metrics.active}</div>
            <p className="text-xs text-muted-foreground mt-1">Operational with live sessions</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Suspended
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{metrics.suspended}</div>
            <p className="text-xs text-muted-foreground mt-1">Engine-level lockout active</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform Headcount
            </CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Total provisioned user seats</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setSearchParams({ tab: val })}
        className="space-y-4"
      >
        <TabsList className="bg-muted/60 p-1 border">
          <TabsTrigger value="tenants" className="gap-2 text-xs font-medium">
            <Building2 className="w-3.5 h-3.5" />
            Tenant Workspaces ({tenants.length})
          </TabsTrigger>

          {platformRole === "Master_SSA" && (
            <TabsTrigger value="admins" className="gap-2 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Platform Operators ({platformAdmins.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Workspaces Tab */}
        <TabsContent value="tenants" className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workspace, slug, or admin email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["all", "active", "suspended", "trial", "archived"].map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className="text-xs capitalize h-8"
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold">Workspace Name & Slug</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Seat Utilization</TableHead>
                  <TableHead className="text-xs font-semibold">Primary Administrator</TableHead>
                  <TableHead className="text-xs font-semibold">Provisioned</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loadingTenants ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading workspaces telemetry...
                    </TableCell>
                  </TableRow>
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                      No tenant workspaces found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & Slug */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {t.logo_url ? (
                            <img
                              src={t.logo_url}
                              alt={t.name}
                              className="w-8 h-8 rounded-lg object-contain bg-muted border shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <TruncatedTitle text={t.name} className="truncate" />
                              {t.id === "00000000-0000-0000-0000-000000000001" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              /{t.slug}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium capitalize px-2 py-0.5 ${
                            t.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : t.status === "suspended"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : t.status === "trial"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {t.status}
                        </Badge>
                      </TableCell>

                      {/* Seat Counts */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground">
                            {t.active_users}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {t.total_users} active
                          </span>
                        </div>
                      </TableCell>

                      {/* Admin Info */}
                      <TableCell>
                        {t.admin_email ? (
                          <div>
                            <div className="font-medium text-xs text-foreground">
                              {t.admin_name || "Admin"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {t.admin_email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">None assigned</span>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {t.created_at ? format(new Date(t.created_at), "MMM dd, yyyy") : "-"}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">Workspace Controls</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleCopyId(t.id)}
                              className="text-xs cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 mr-2" /> Copy Tenant ID
                            </DropdownMenuItem>

                            {platformRole === "Master_SSA" && (
                              <>
                                <DropdownMenuSeparator />
                                {t.status !== "active" ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({ tenantId: t.id, newStatus: "active" })
                                    }
                                    className="text-xs text-emerald-600 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Activate Workspace
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({ tenantId: t.id, newStatus: "suspended" })
                                    }
                                    className="text-xs text-amber-600 cursor-pointer"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Suspend Workspace
                                  </DropdownMenuItem>
                                )}

                                {t.status !== "archived" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({ tenantId: t.id, newStatus: "archived" })
                                    }
                                    className="text-xs text-neutral-600 cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5 mr-2" /> Archive Workspace
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Platform SSAs Tab */}
        {platformRole === "Master_SSA" && (
          <TabsContent value="admins" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delegated Platform Operators</h3>
                <p className="text-xs text-muted-foreground">
                  Administrators with platform-wide authorities across all tenant workspaces.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setAssignOpen(true)}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Admin
              </Button>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold">Administrator</TableHead>
                    <TableHead className="text-xs font-semibold">Platform Role</TableHead>
                    <TableHead className="text-xs font-semibold">User UUID</TableHead>
                    <TableHead className="text-xs font-semibold">Granted Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loadingAdmins ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading platform operators...
                      </TableCell>
                    </TableRow>
                  ) : platformAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                        No additional platform administrators configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    platformAdmins.map((adm) => (
                      <TableRow key={adm.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-xs text-foreground">
                              {adm.user?.full_name || "Platform Operator"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {adm.user?.email || "Unknown Email"}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold ${
                              adm.role === "Master_SSA"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : adm.role === "Provisioning_SSA"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {adm.role.replace("_", " ")}
                          </Badge>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {adm.user_id.slice(0, 13)}...
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {adm.created_at ? format(new Date(adm.created_at), "MMM dd, yyyy") : "-"}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={adm.user_id === user?.id}
                            onClick={() => {
                              if (confirm(`Revoke platform role from ${adm.user?.email || "this operator"}?`)) {
                                revokeMutation.mutate(adm.user_id);
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Provision Workspace Modal */}
      <ProvisionTenantModal
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        onSuccess={() => refetchTenants()}
      />

      {/* Assign SSA Modal */}
      <AssignSSAModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onSuccess={() => refetchAdmins()}
      />
    </div>
  );
}

