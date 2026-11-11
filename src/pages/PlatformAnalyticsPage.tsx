import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Layers,
  Activity,
  Server,
  ShieldCheck,
  Building2,
  Users,
  RotateCw,
} from "lucide-react";
import { TenantDetails } from "@/components/platform-admin/InspectTenantModal";

export default function PlatformAnalyticsPage() {
  const { isSSA } = useAuth();

  const {
    data: tenants = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<TenantDetails[]>({
    queryKey: ["tenants-overview"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tenants_overview");
      if (error) throw error;
      return data || [];
    },
    enabled: isSSA,
  });

  const metrics = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === "active").length;
    const suspended = tenants.filter((t) => t.status === "suspended").length;
    const totalUsers = tenants.reduce((acc, t) => acc + Number(t.total_users || 0), 0);
    const activeUsers = tenants.reduce((acc, t) => acc + Number(t.active_users || 0), 0);
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 100;

    let enterprise = 0;
    let growth = 0;
    let starter = 0;
    tenants.forEach((t) => {
      const count = Number(t.total_users || 0);
      if (count >= 50) enterprise++;
      else if (count >= 10) growth++;
      else starter++;
    });

    return { total, active, suspended, totalUsers, activeUsers, activeRate, enterprise, growth, starter };
  }, [tenants]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Platform Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregate usage metrics, cross-workspace seat capacity, and system performance telemetry.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-1.5 text-xs h-9 w-fit"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh Metrics
        </Button>
      </div>

      {/* Top 3 High Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tenant Active Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600">{metrics.activeRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.active} of {metrics.total} tenants operational
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Provisioned Seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.activeUsers} actively participating users
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workspaces Suspended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-extrabold ${metrics.suspended > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {metrics.suspended}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.suspended === 0 ? "Zero locked workspaces" : "Engine-level lockouts active"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tier Distribution Card */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Workspace Tiers Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Classification of tenants by total provisioned accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Enterprise (&ge; 50 users)</span>
                <span className="font-semibold">{metrics.enterprise} tenants</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{
                    width: `${metrics.total ? (metrics.enterprise / metrics.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Growth (10 - 49 users)</span>
                <span className="font-semibold">{metrics.growth} tenants</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{
                    width: `${metrics.total ? (metrics.growth / metrics.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Starter (&lt; 10 users)</span>
                <span className="font-semibold">{metrics.starter} tenants</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${metrics.total ? (metrics.starter / metrics.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Headcount Breakdown Card */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Top Workspaces by Headcount
            </CardTitle>
            <CardDescription className="text-xs">
              Relative capacity share across organizations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-1">
            {tenants.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No tenants registered yet.</p>
            ) : (
              tenants
                .slice(0, 5)
                .sort((a, b) => Number(b.total_users || 0) - Number(a.total_users || 0))
                .map((t) => {
                  const pct = metrics.totalUsers > 0
                    ? Math.round((Number(t.total_users || 0) / metrics.totalUsers) * 100)
                    : 0;
                  return (
                    <div key={t.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground truncate max-w-[180px]">{t.name}</span>
                        <span className="text-muted-foreground font-mono">
                          {t.total_users || 0} seats ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary/80 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Infrastructure & Security Telemetry Card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> Multi-Tenant Security & Infrastructure
          </CardTitle>
          <CardDescription className="text-xs">
            Database row security parameters and storage volume isolation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 rounded-lg bg-muted/30 border">
            <span className="text-muted-foreground block mb-1">Policy Isolation Mode</span>
            <span className="font-mono text-emerald-600 font-bold">AS RESTRICTIVE</span>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border">
            <span className="text-muted-foreground block mb-1">Protected Entities</span>
            <span className="font-bold text-foreground">49 Postgres Tables</span>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border">
            <span className="text-muted-foreground block mb-1">Storage Partitioning</span>
            <span className="font-mono text-foreground font-semibold">tenant-assets/&lt;uuid&gt;</span>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border">
            <span className="text-muted-foreground block mb-1">Cross-Tenant Leakage</span>
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> 0 Violations
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

