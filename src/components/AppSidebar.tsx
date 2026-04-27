import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  Calendar,
  FolderKanban,
  BarChart3,
  Megaphone,
  Settings,
  ClipboardList,
  Briefcase,
  Send,
  CalendarCheck,
  Shield,
  User,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/constants";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import zielLogoWhite from "@/assets/ziel-logo-white.png";

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Attendance", url: "/attendance", icon: Clock },
  { title: "Daily Logs", url: "/logs/all", icon: FileText },
  { title: "Leave", url: "/leave/requests", icon: Calendar },
  { title: "Clients", url: "/clients", icon: Briefcase },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Audit Log", url: "/audit", icon: Shield },
];

const managerNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Attendance", url: "/attendance", icon: Clock },
  { title: "Daily Logs", url: "/logs/all", icon: FileText },
  { title: "Leave", url: "/leave/requests", icon: Calendar },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
];

const employeeNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clock In/Out", url: "/attendance/my", icon: Clock },
  { title: "Submit Log", url: "/logs/submit", icon: Send },
  { title: "My Logs", url: "/logs/my", icon: ClipboardList },
  { title: "My Attendance", url: "/attendance/my", icon: Clock },
  { title: "My Leave", url: "/leave/my", icon: CalendarCheck },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { profile, user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const role = profile?.role;
  const isAdminOrManager = role === "admin" || role === "manager";
  const items = role === "admin" ? adminNav : role === "manager" ? managerNav : employeeNav;

  // Unread announcements badge
  const { data: unreadCount } = useQuery({
    queryKey: ["unread-announcements", user?.id],
    queryFn: async () => {
      const { data: announcements } = await supabase
        .from("announcements")
        .select("id")
        .lte("publish_at", new Date().toISOString());
      if (!announcements?.length) return 0;

      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user!.id);

      const readIds = new Set(reads?.map((r) => r.announcement_id) || []);
      return announcements.filter((a) => !readIds.has(a.id)).length;
    },
    enabled: !!user?.id && !!profile?.id,
    refetchInterval: 60000,
  });

  // Pending leave requests badge (admin/manager only)
  const { data: pendingLeaveCount } = useQuery({
    queryKey: ["pending-leave-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    enabled: isAdminOrManager,
    refetchInterval: 30000,
  });

  const getBadgeCount = (title: string): number => {
    if (title === "Announcements") return unreadCount || 0;
    if (title === "Leave" && isAdminOrManager) return pendingLeaveCount || 0;
    return 0;
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        {!collapsed ? (
          <img src={zielLogoWhite} alt="Ziel" className="h-7" />
        ) : (
          <img src={zielLogoWhite} alt="Ziel" className="h-6 w-6 object-contain" />
        )}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                const badgeCount = getBadgeCount(item.title);
                const showBadge = badgeCount > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="!bg-sidebar-accent !text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <span className="flex items-center gap-2 flex-1">
                            {item.title}
                            {showBadge && (
                              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-3">
        <span className="text-[11px] text-sidebar-foreground/40">{APP_VERSION}</span>
      </SidebarFooter>
    </Sidebar>
  );
}
