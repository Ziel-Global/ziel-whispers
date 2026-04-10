import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "Admin Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {profile?.full_name ?? "User"}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Employees", value: "—" },
          { label: "Today's Logs", value: "—" },
          { label: "Pending Leaves", value: "—" },
          { label: "Active Projects", value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-card p-5">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
