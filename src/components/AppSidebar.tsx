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
  ChevronRight,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
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

interface NavSection {
  label: string;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export function AppSidebar() {
  const { profile, user } = useAuth();
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  const role = profile?.role;
  const isClient = profile?.designation === "Client" || profile?.designation === "Client Member";
  const isAdminOrManager = role === "admin" || role === "manager";

  // Grouped Navigation Sections based on Role
  const sections = useMemo<NavSection[]>(() => {
    if (isClient) {
      return [
        {
          label: "MAIN MENU",
          items: [{ title: "Projects", url: "/projects", icon: FolderKanban }],
        },
      ];
    }

    if (role === "admin") {
      return [
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
    }

    if (role === "manager") {
      return [
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
    }

    // Default: Employee
    return [
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
  }, [role, isClient]);

  // Subtitle subtitle badge
  const portalSubtitle = useMemo(() => {
    if (isClient) return "Client Portal";
    if (role === "admin") return "Admin Console";
    if (role === "manager") return "Manager Console";
    return "Employee Portal";
  }, [role, isClient]);

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

  const userInitials = (profile?.full_name || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r border-black/10 bg-white">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#17171A] flex items-center justify-center shrink-0">
            <span className="text-[#EB5A1E] font-extrabold text-[15px] tracking-tight">Zi</span>
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold text-[15px] leading-tight text-[#17171A]">Ziel</div>
              <div className="text-[11.5px] text-[#8B8B92] font-medium">{portalSubtitle}</div>
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="px-4 py-3 space-y-4">
        {sections.map((sec) => (
          <SidebarGroup key={sec.label} className="p-0 space-y-1">
            {!collapsed && (
              <SidebarGroupLabel className="px-2 text-[10.5px] font-bold text-[#B0B0B6] tracking-wider uppercase mb-1">
                {sec.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {sec.items.map((item) => {
                  const isDashboard = item.url === "/" || item.url === "/dashboard";
                  const isActive = isDashboard
                    ? location.pathname === "/" || location.pathname === "/dashboard"
                    : location.pathname.startsWith(item.url);
                  const badgeCount = getBadgeCount(item.title);
                  const showBadge = badgeCount > 0;
                  const isProjectsItem = item.title === "Projects" && isClient;

                  return (
                    <SidebarMenuItem key={item.title} className="relative">
                      {/* Active Indicator Orange Bar - Detached on left edge */}
                      {isActive && (
                        <div className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] bg-[#EB5A1E] z-10" />
                      )}

                      {isProjectsItem ? (
                        <>
                          <SidebarMenuButton
                            onClick={() => {
                              setProjectsSubOpen(!projectsSubOpen);
                              setOpenMobile(false);
                            }}
                            isActive={isActive}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-[11px] text-[13.5px] font-medium transition-all ${
                              isActive
                                ? "!bg-white !border !border-black/10 text-[#17171A] font-bold shadow-xs"
                                : "text-[#4B4B52] hover:bg-[#F6F5F3] hover:text-[#17171A]"
                            }`}
                          >
                            <item.icon
                              className={`h-[18px] w-[18px] shrink-0 ${
                                isActive ? "text-[#17171A]" : "text-[#8B8B92]"
                              }`}
                            />
                            {!collapsed && (
                              <span className="flex items-center justify-between flex-1">
                                <span>{item.title}</span>
                              </span>
                            )}
                          </SidebarMenuButton>
                          {!collapsed && projectsSubOpen && isOnProjectDetail && (
                            <SidebarMenuSub className="ml-4 border-l border-black/10 pl-2">
                              {clientProjectNav.map((sub) => (
                                <SidebarMenuSubItem key={sub.value}>
                                  <SidebarMenuSubButton asChild onClick={() => setOpenMobile(false)}>
                                    <NavLink
                                      to={`/projects/${currentProjectSlug}?tab=${sub.value}`}
                                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                                        currentTab === sub.value
                                          ? "text-[#EB5A1E] font-semibold !bg-white"
                                          : "text-[#8B8B92] hover:text-[#17171A] hover:bg-[#F6F5F3]"
                                      }`}
                                    >
                                      <span>{sub.label}</span>
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
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-[11px] text-[13.5px] font-medium transition-all ${
                              isActive
                                ? "!bg-white !border !border-black/10 text-[#17171A] font-bold shadow-xs"
                                : "text-[#4B4B52] hover:bg-[#F6F5F3] hover:text-[#17171A]"
                            }`}
                          >
                            <item.icon
                              className={`h-[18px] w-[18px] shrink-0 ${
                                isActive ? "text-[#17171A]" : "text-[#8B8B92]"
                              }`}
                            />
                            {!collapsed && (
                              <span className="flex items-center justify-between flex-1 min-w-0">
                                <span className="truncate">{item.title}</span>
                                {showBadge && (
                                  <span className="bg-[#EB5A1E] text-white text-[10px] font-bold rounded-full h-4 min-w-[18px] flex items-center justify-center px-1 shrink-0">
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

      {/* Footer Profile Card */}
      <SidebarFooter className="p-3 border-t border-black/5 mt-auto">
        {!collapsed ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 p-2 rounded-[11px] border border-black/10 bg-white">
              <div className="w-8 h-8 rounded-full bg-[#DFF6E4] text-[#1FAA59] flex items-center justify-center font-bold text-[12.5px] shrink-0">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-[#17171A] truncate">
                  {profile?.full_name || user?.email}
                </div>
                <div className="text-[11px] text-[#8B8B92] capitalize truncate">
                  {profile?.designation || role || "User"}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#B0B0B6] shrink-0" />
            </div>
            <div className="text-[10.5px] text-[#C6C6CC] text-center font-medium">{APP_VERSION}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#DFF6E4] text-[#1FAA59] flex items-center justify-center font-bold text-[12.5px]">
              {userInitials}
            </div>
            <span className="text-[9px] text-[#C6C6CC] font-medium">{APP_VERSION}</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
