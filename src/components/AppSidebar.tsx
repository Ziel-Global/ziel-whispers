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
  GitBranch,
  Briefcase,
  Send,
  CalendarCheck,
  Shield,
  User,
  Bell,
  Search,
  ChevronRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const adminGroups = [
  {
    label: "MAIN MENU",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Active Users", url: "/employees", icon: Users },
      { title: "Attendance", url: "/attendance", icon: Clock },
      { title: "Daily Logs", url: "/logs/all", icon: FileText },
      { title: "Leave", url: "/leave/requests", icon: Calendar },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell },
      { title: "Clients", url: "/clients", icon: Briefcase },
      { title: "Projects", url: "/projects", icon: FolderKanban },
      { title: "Reports", url: "/reports", icon: BarChart3 },
      { title: "Announcements", url: "/announcements", icon: Megaphone },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { title: "Settings", url: "/settings", icon: Settings },
      { title: "Workflow", url: "/workflow-templates", icon: GitBranch },
      { title: "Audit Log", url: "/audit", icon: Shield },
    ],
  },
];

const managerGroups = [
  {
    label: "MAIN MENU",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Attendance", url: "/attendance", icon: Clock },
      { title: "Daily Logs", url: "/logs/all", icon: FileText },
      { title: "Leave", url: "/leave/requests", icon: Calendar },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell },
      { title: "Projects", url: "/projects", icon: FolderKanban },
      { title: "Reports", url: "/reports", icon: BarChart3 },
      { title: "Announcements", url: "/announcements", icon: Megaphone },
    ],
  },
];

const employeeGroups = [
  {
    label: "MAIN MENU",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Clock In/Out", url: "/attendance/my", icon: Clock },
      { title: "Submit Log", url: "/logs/submit", icon: Send },
      { title: "My Logs", url: "/logs/my", icon: ClipboardList },
      { title: "My Attendance", url: "/attendance/my", icon: Clock },
      { title: "Leave & Requests", url: "/leave/my", icon: CalendarCheck },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell },
      { title: "My Projects", url: "/my-projects", icon: FolderKanban },
      { title: "Announcements", url: "/announcements", icon: Megaphone },
      { title: "Profile", url: "/profile", icon: User },
    ],
  },
];

const clientGroups = [
  {
    label: "MAIN MENU",
    items: [
      { title: "Projects", url: "/projects", icon: FolderKanban },
    ],
  },
];

export function AppSidebar() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname]);

  const role = profile?.role;
  const isClient = profile?.designation === "Client" || profile?.designation === "Client Member";
  const isAdminOrManager = role === "admin" || role === "manager";
  const groups = isClient
    ? clientGroups
    : role === "admin"
    ? adminGroups
    : role === "manager"
    ? managerGroups
    : employeeGroups;

  // Project detail sub-navigation (client portal only)
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const [projectsSubOpen, setProjectsSubOpen] = useState(false);
  const currentProjectSlug = projectMatch?.[1] || null;
  const isOnProjectDetail = isClient && !!currentProjectSlug;
  const currentTab = new URLSearchParams(location.search).get("tab") || "overview";
  const clientProjectNav = [
    { label: "Overview", value: "overview" },
    { label: "Phase Progress", value: "phase-progress" },
    { label: "Tasks", value: "tasks" },
    { label: "Blockers", value: "blockers" },
    { label: "Project Updates", value: "status-updates" },
    { label: "Action Items", value: "action-items" },
    { label: "Resources", value: "resources" },
  ];
  useEffect(() => {
    if (isOnProjectDetail) setProjectsSubOpen(true);
  }, [isOnProjectDetail]);

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

  // Pending leave and WFH requests badge (admin/manager only)
  const { data: pendingLeaveCount } = useQuery({
    queryKey: ["pending-leave-count"],
    queryFn: async () => {
      const { count: leaveCount, error: leaveError } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (leaveError) throw leaveError;

      const { count: wfhCount, error: wfhError } = await supabase
        .from("remote_work_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (wfhError) throw wfhError;

      return (leaveCount || 0) + (wfhCount || 0);
    },
    enabled: isAdminOrManager,
    refetchInterval: 30000,
  });

  // Employee unseen requests badge
  const { data: employeeUnseenCount } = useQuery({
    queryKey: ["employee-unseen-requests", user?.id],
    queryFn: async () => {
      const lastSeen = localStorage.getItem(`leave_last_seen_${user!.id}`) || "2000-01-01T00:00:00Z";
      
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("id")
        .eq("user_id", user!.id)
        .in("status", ["approved", "rejected"])
        .gt("reviewed_at", lastSeen);
        
      const { data: wfh } = await supabase
        .from("remote_work_requests")
        .select("id")
        .eq("user_id", user!.id)
        .in("status", ["approved", "rejected"])
        .gt("reviewed_at", lastSeen);
        
      return (leaves?.length || 0) + (wfh?.length || 0);
    },
    enabled: !isAdminOrManager && !!user?.id,
    refetchInterval: 30000,
  });

  const getBadgeCount = (title: string): number => {
    if (title === "Announcements") return unreadCount || 0;
    if (title === "Leave" && isAdminOrManager) return pendingLeaveCount || 0;
    if (title === "Leave & Requests" && !isAdminOrManager) return employeeUnseenCount || 0;
    return 0;
  };

  const userInitials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "BF";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      {/* Brand Header */}
      <div className="flex h-18 items-center px-4 pt-3 pb-2 border-b border-border/40 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#17171A] flex items-center justify-center text-white font-bold text-base shadow-xs">
            Z
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground tracking-tight leading-none">Ziel</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Admin Console</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Input Bar (Sidebar Search) */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between bg-muted/70 hover:bg-muted transition-colors rounded-xl px-3 py-1.5 text-xs text-muted-foreground border border-border/50 cursor-pointer">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Search</span>
            </div>
            <kbd className="text-[10px] font-medium bg-background px-1.5 py-0.5 rounded border border-border text-muted-foreground shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <SidebarContent className="bg-card px-2 py-2 space-y-4">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            {!collapsed && (
              <SidebarGroupLabel className="text-muted-foreground/70 text-[10px] font-bold uppercase tracking-wider px-3 mb-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                  const badgeCount = getBadgeCount(item.title);
                  const showBadge = badgeCount > 0;
                  const isProjectsItem = item.title === "Projects" && isClient;
                  return (
                    <SidebarMenuItem key={item.title}>
                      {isProjectsItem ? (
                        <>
                          <SidebarMenuButton
                            onClick={() => { setProjectsSubOpen(!projectsSubOpen); setOpenMobile(false); }}
                            isActive={isActive}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-accent/70 text-foreground font-bold border-l-4 border-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <item.icon className="h-4 w-4 shrink-0 text-foreground" />
                            {!collapsed && (
                              <span className="flex items-center gap-2 flex-1">
                                {item.title}
                              </span>
                            )}
                          </SidebarMenuButton>
                          {!collapsed && projectsSubOpen && isOnProjectDetail && (
                            <SidebarMenuSub>
                              {clientProjectNav.map((sub) => (
                                <SidebarMenuSubItem key={sub.value}>
                                  <SidebarMenuSubButton
                                    asChild
                                    onClick={() => setOpenMobile(false)}
                                  >
                                    <NavLink
                                      to={`/projects/${currentProjectSlug}?tab=${sub.value}`}
                                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                        currentTab === sub.value
                                          ? "text-primary font-bold bg-accent"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                      }`}
                                    >
                                      <span className="text-xs">
                                        {sub.label}
                                      </span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          )}
                        </>
                      ) : (
                        <SidebarMenuButton asChild isActive={isActive} onClick={() => setOpenMobile(false)}>
                          <NavLink
                            to={item.url}
                            end={item.url === "/"}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-accent/60 text-foreground font-bold border-l-3 border-primary shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary stroke-[2.2]" : "text-muted-foreground"}`} />
                            {!collapsed && (
                              <span className="flex items-center gap-2 flex-1">
                                {item.title}
                                {showBadge && (
                                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4.5 min-w-[18px] flex items-center justify-center px-1">
                                    {badgeCount > 99 ? "99+" : badgeCount}
                                  </span>
                                )}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Bottom User Profile Card & Version */}
      <SidebarFooter className="p-3 bg-card border-t border-border/40">
        {!collapsed ? (
          <div className="space-y-2">
            <div 
              onClick={() => navigate("/profile")}
              className="flex items-center justify-between p-2 rounded-xl border border-border/60 hover:bg-muted/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate leading-tight">
                    {profile?.full_name || "Basil Fawwad"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate font-medium">
                    {profile?.role === "admin" ? "Super Admin" : profile?.designation || "Admin"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
            </div>
            <div className="text-center">
              <span className="text-[10px] text-muted-foreground/60 font-medium">{APP_VERSION}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center border border-emerald-200">
              {userInitials}
            </div>
            <span className="text-[9px] text-muted-foreground/50">{APP_VERSION}</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
