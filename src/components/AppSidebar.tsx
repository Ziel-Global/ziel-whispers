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
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import zielLogo from "@/assets/ziel-logo.png";

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Daily Logs", url: "/logs/all", icon: FileText },
  { title: "Attendance", url: "/attendance", icon: Clock },
  { title: "Leave", url: "/leave/requests", icon: Calendar },
  { title: "Clients", url: "/clients", icon: Briefcase },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Settings", url: "/settings", icon: Settings },
];

const employeeNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Submit Log", url: "/logs/submit", icon: Send },
  { title: "My Logs", url: "/logs/my", icon: ClipboardList },
  { title: "Attendance", url: "/attendance/my", icon: Clock },
  { title: "Leave", url: "/leave/my", icon: CalendarCheck },
  { title: "My Projects", url: "/my-projects", icon: Briefcase },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
];

export function AppSidebar() {
  const { profile } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const items = isAdmin ? adminNav : employeeNav;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        {!collapsed ? (
          <img src={zielLogo} alt="Ziel Logs" className="h-7 invert" />
        ) : (
          <span className="text-lg font-bold text-sidebar-primary">Z</span>
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
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
