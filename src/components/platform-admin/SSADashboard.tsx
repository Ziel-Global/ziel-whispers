import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  ShieldCheck,
  Shield,
  BarChart3,
  Plus,
  ArrowRight,
  Sparkles,
  Server,
  Lock,
} from "lucide-react";
import { ProvisionTenantModal } from "./ProvisionTenantModal";
import { TenantDetails } from "./InspectTenantModal";

export function SSADashboard() {
  const { user, profile, platformRole, isSSA } = useAuth();
  const navigate = useNavigate();
  const [provisionOpen, setProvisionOpen] = useState(false);

  // Fetch Tenants for summary counts only
  const { data: tenants = [], refetch } = useQuery<TenantDetails[]>({
    queryKey: ["tenants-overview"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tenants_overview");
      if (error) throw error;
      return data || [];
    },
    enabled: isSSA,
  });

  // Fetch Admins count
  const { data: platformAdmins = [] } = useQuery({
    queryKey: ["platform-admins-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_roles")
        .select("id, role");
      if (error) return [];
      return data || [];
    },
    enabled: isSSA,
  });

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const totalUsers = tenants.reduce((acc, t) => acc + Number(t.total_users || 0), 0);

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
      {/* Welcome & Platform Header */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-muted p-6 md:p-8 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-xs font-semibold px-2.5 py-0.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" />
              {platformRole?.replace("_", " ") || "Master SSA"}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">Platform Operator Console</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Welcome back, {profile?.full_name || "Platform Admin"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            You are managing the Ziel multi-tenant cloud environment. Select a workspace tab below or launch a new tenant.
          </p>
        </div>

        <Button
          onClick={() => setProvisionOpen(true)}
          size="lg"
          className="gap-2 shadow-md shrink-0 h-11 px-5"
        >
          <Plus className="w-4 h-4" />
          Provision Workspace
        </Button>
      </div>

      {/* 4 Clean Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <Card
          onClick={() => navigate("/tenants")}
          className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group border-border"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workspaces
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalTenants}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>{activeTenants} active</span>
              <span className="text-primary font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                Open <ArrowRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card
          onClick={() => navigate("/platform-analytics")}
          className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group border-border"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Users
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>Across all tenants</span>
              <span className="text-primary font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                Analytics <ArrowRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Sub-Admins */}
        <Card
          onClick={() => navigate("/platform-admins")}
          className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group border-border"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform SSAs
            </CardTitle>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{platformAdmins.length || 1}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>Platform operators</span>
              <span className="text-primary font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                Manage <ArrowRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="border-border bg-muted/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              System Security
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Lock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5 pt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              100% Isolated
            </div>
            <p className="text-xs text-muted-foreground mt-1">Multi-tenant RLS active</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Feature Cards / Quick Links */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Platform Navigation</h2>
          <p className="text-xs text-muted-foreground">
            Direct shortcuts to dedicated operational workspaces.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tenants Hub */}
          <Card
            onClick={() => navigate("/tenants")}
            className="p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-2">
                  Tenant Workspaces Directory
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Browse corporate tenants, view headcount, manage custom branding, and inspect individual tenant details.
                </p>
                <div className="pt-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {totalTenants} Registered Workspaces
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Sub-Admins */}
          <Card
            onClick={() => navigate("/platform-admins")}
            className="p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-2">
                  SSA Sub-Admins & Permissions
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Assign administrative credentials, grant Provisioning SSA or Support SSA roles, and review security operators.
                </p>
                <div className="pt-2">
                  <Badge variant="secondary" className="text-[11px]">
                    Role Delegation Console
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Analytics & Reports */}
          <Card
            onClick={() => navigate("/platform-analytics")}
            className="p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-2">
                  Analytics & Reports
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inspect aggregate seat capacity, workspace tier distribution, operational active rates, and system reports.
                </p>
                <div className="pt-2">
                  <Badge variant="secondary" className="text-[11px]">
                    Cross-Tenant Telemetry
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Audit Logs */}
          <Card
            onClick={() => navigate("/audit")}
            className="p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors flex items-center gap-2">
                  Tenant-Filtered Audit Logs
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Review immutable system security logs with tenant-specific dropdown filters to isolate logs per organization.
                </p>
                <div className="pt-2">
                  <Badge variant="secondary" className="text-[11px]">
                    Multi-Tenant Audit Stream
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Provision Modal */}
      <ProvisionTenantModal
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
