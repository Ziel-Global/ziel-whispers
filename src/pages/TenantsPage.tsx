import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TruncatedTitle } from "@/components/ui/truncated-title";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Building2,
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Copy,
  ChevronRight,
  Eye,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { ProvisionTenantModal } from "@/components/platform-admin/ProvisionTenantModal";
import { InspectTenantModal, TenantDetails } from "@/components/platform-admin/InspectTenantModal";

export default function TenantsPage() {
  const { isSSA, platformRole } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetails | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  // Fetch Tenants Overview
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
      if (selectedTenant && selectedTenant.id === vars.tenantId) {
        setSelectedTenant((prev) => (prev ? { ...prev, status: vars.newStatus } : null));
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update workspace status");
    },
  });

  const handleToggleStatus = (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    statusMutation.mutate({ tenantId, newStatus });
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success("Tenant UUID copied");
  };

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

  const openTenantDetails = (tenant: TenantDetails) => {
    setSelectedTenant(tenant);
    setInspectOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Tenant Workspaces
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and view provisioned organizations. Click on any tenant to view full details.
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

          <Button
            size="sm"
            onClick={() => setProvisionOpen(true)}
            className="gap-1.5 text-xs h-9 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Provision New Tenant
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name, slug, or admin email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({tenants.length})</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="suspended">Suspended Only</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tenants Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading tenant workspaces...
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">No tenant workspaces found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or status filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const isSusp = tenant.status === "suspended";
            return (
              <Card
                key={tenant.id}
                onClick={() => openTenantDetails(tenant)}
                className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {tenant.logo_url ? (
                        <img
                          src={tenant.logo_url}
                          alt={tenant.name}
                          className="w-10 h-10 rounded-lg object-contain border bg-white p-1 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {tenant.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <TruncatedTitle
                          as="h3"
                          text={tenant.name}
                          className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors tracking-tight leading-none"
                        />
                        <CardDescription className="text-xs font-mono text-muted-foreground truncate">
                          /{tenant.slug}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold px-2 py-0.5 shrink-0 ${
                        tenant.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : isSusp
                          ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      }`}
                    >
                      {tenant.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs pt-0">
                  <div className="bg-muted/30 rounded-lg p-2.5 border space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" /> Headcount:
                      </span>
                      <span className="font-semibold text-foreground">
                        {tenant.total_users || 0} Users ({tenant.active_users || 0} active)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-primary" /> Admin:
                      </span>
                      <span className="font-medium text-foreground truncate max-w-[150px]">
                        {tenant.admin_email || "Not assigned"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>
                      Created: {tenant.created_at ? format(new Date(tenant.created_at), "dd-MMM-yyyy") : "—"}
                    </span>
                    <span className="font-medium text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      View details <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Provision Modal */}
      <ProvisionTenantModal
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        onSuccess={() => refetch()}
      />

      {/* Detailed Modal on Click */}
      <InspectTenantModal
        tenant={selectedTenant}
        open={inspectOpen}
        onOpenChange={setInspectOpen}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
}

