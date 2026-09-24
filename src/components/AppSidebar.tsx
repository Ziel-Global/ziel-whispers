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
  ChevronDown,
  LayoutGrid,
  TrendingUp,
  ListChecks,
  AlertCircle,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/constants";
import { toSlug } from "@/lib/utils";
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

interface NavSection {
  label: string;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const CLIENT_NAV_GROUPS: {
  label: string;
  items: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    countKey?: string;
  }[];
}[] = [
  {
    label: "Project",
    items: [
      { label: "Overview", value: "overview", icon: LayoutGrid },
      { label: "Phase Progress", value: "phase-progress", icon: TrendingUp },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Tasks", value: "tasks", icon: ListChecks, countKey: "tasks" },
      { label: "Blockers", value: "blockers", icon: AlertCircle, countKey: "blockers" },
      { label: "Action Items", value: "action-items", icon: CheckSquare, countKey: "actionItems" },
    ],
  },
  {
    label: "Collaboration",
    items: [
      { label: "Project Updates", value: "status-updates", icon: MessageSquare },
      { label: "Resources", value: "resources", icon: Users, countKey: "resources" },
    ],
  },
];

export function AppSidebar() {
  const { profile, user } = useAuth();
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const switcherRef = useRef<HTMLDivElement>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  const role = profile?.role;
  const isClient = profile?.designation === "Client" || profile?.designation === "Client Member";
  const isAdminOrManager = role === "admin" || role === "manager";

  const sections = useMemo<NavSection[]>(() => {
    if (isClient) {
      return [
        {
          label: "MAIN MENU",
          items: [{ title: "My Projects", url: "/projects", icon: FolderKanban }],
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

  const portalSubtitle = useMemo(() => {
    if (isClient) return "Client Portal";
    if (role === "admin") return "Admin Console";
    if (role === "manager") return "Manager Console";
    return "Employee Portal";
  }, [role, isClient]);

  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const currentProjectSlug = projectMatch?.[1] || null;
  const isOnProjectDetail = isClient && !!currentProjectSlug;
  const currentTab = new URLSearchParams(location.search).get("tab") || "overview";
  const isProjectsList = location.pathname === "/projects" || location.pathname === "/projects/";

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name)")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isClient && !!user?.id,
  });

  const { data: myMemberships } = useQuery({
    queryKey: ["my-project-memberships", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("project_id, project_role_id, project_roles(name)")
        .eq("user_id", user!.id)
        .is("removed_at", null);
      return data || [];
    },
    enabled: isClient && !!user?.id,
  });

  const clientProjects = useMemo(() => {
    if (!projects) return [];
    // While memberships load, trust RLS-scoped projects (same as Projects list).
    if (!myMemberships) return projects;
    const myProjectIds = new Set(myMemberships.map((m) => m.project_id));
    const userClientId = (profile as any)?.client_id;
    const filtered = projects.filter(
      (p) =>
        myProjectIds.has(p.id) ||
        (userClientId && p.client_id === userClientId) ||
        p.client_visible === true
    );
    // Avoid empty switcher if over-filter wiped RLS-visible projects.
    return filtered.length > 0 ? filtered : projects;
  }, [projects, myMemberships, profile]);

  const currentProject = useMemo(() => {
    if (!currentProjectSlug || !clientProjects.length) return null;
    return clientProjects.find((p) => toSlug(p.name) === currentProjectSlug) || null;
  }, [clientProjects, currentProjectSlug]);

  const [switcherRect, setSwitcherRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const openSwitcher = () => {
    const el = switcherRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setSwitcherRect({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 220) });
    }
    setSwitcherOpen((o) => !o);
  };

  useEffect(() => {
    if (!switcherOpen) return;
    const updateRect = () => {
      const el = switcherRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSwitcherRect({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 220) });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [switcherOpen]);

  const { data: navCounts } = useQuery({
    queryKey: ["client-sidebar-nav-counts", currentProject?.id],
    queryFn: async () => {
      const pid = currentProject!.id;
      const [tasksRes, blockersRes, actionRes, membersRes] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", pid),
        supabase
          .from("task_blockers")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid)
          .neq("status", "resolved"),
        supabase
          .from("client_action_items")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid),
        supabase
          .from("project_members")
          .select("id, users(designation)")
          .eq("project_id", pid)
          .is("removed_at", null),
      ]);
      const resources = (membersRes.data || []).filter(
        (m: any) => !["Client", "Client Member"].includes(m.users?.designation)
      ).length;
      return {
        tasks: tasksRes.count ?? 0,
        blockers: blockersRes.count ?? 0,
        actionItems: actionRes.count ?? 0,
        resources,
      };
    },
    enabled: isOnProjectDetail && !!currentProject?.id,
  });

  useEffect(() => {
    setSwitcherOpen(false);
  }, [currentProjectSlug]);

  useEffect(() => {
    if (!switcherOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (switcherRef.current?.contains(target)) return;
      const menu = document.getElementById("client-project-switcher-menu");
      if (menu?.contains(target)) return;
      setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [switcherOpen]);

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
    enabled: !isAdminOrManager && !isClient && !!user?.id,
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

  const getNavCount = (countKey?: string): number | null => {
    if (!countKey || !navCounts) return null;
    const val = (navCounts as Record<string, number>)[countKey];
    return typeof val === "number" ? val : null;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-black/10 bg-white">
      <div className="flex items-center justify-between p-4 pb-3 border-b border-black/5">
        <Link
          to="/projects"
          className="flex items-center gap-2.5 min-w-0 rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-[#EB5A1E]/40"
        >
          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#17171A] flex items-center justify-center shrink-0">
            <span className="text-[#EB5A1E] font-extrabold text-[15px] tracking-tight">Zi</span>
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold text-[15px] leading-tight text-[#17171A]">Ziel</div>
              <div className="text-[11.5px] text-[#8B8B92] font-medium">{portalSubtitle}</div>
            </div>
          )}
        </Link>
      </div>

      <SidebarContent className="px-4 py-3 space-y-4">
        {isClient ? (
          <>
            <SidebarGroup className="p-0 space-y-1">
              {!collapsed && (
                <SidebarGroupLabel className="px-2 text-[9px] font-semibold text-[#A1A1A8] tracking-[0.03em] uppercase mb-1">
                  MAIN MENU
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  <SidebarMenuItem className="relative">
                    {(isProjectsList || isOnProjectDetail) && (
                      <div className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] bg-[#EB5A1E] z-10" />
                    )}
                    <SidebarMenuButton
                      asChild
                      isActive={isProjectsList || isOnProjectDetail}
                      onClick={() => setOpenMobile(false)}
                    >
                      <NavLink
                        to="/projects"
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-[11px] text-[13.5px] font-medium transition-all ${
                          isProjectsList || isOnProjectDetail
                            ? "!bg-white !border !border-black/10 text-[#17171A] font-bold shadow-xs"
                            : "text-[#4B4B52] hover:bg-[#F6F5F3] hover:text-[#17171A]"
                        }`}
                      >
                        <FolderKanban
                          className={`h-[18px] w-[18px] shrink-0 ${
                            isProjectsList || isOnProjectDetail ? "text-[#17171A]" : "text-[#8B8B92]"
                          }`}
                        />
                        {!collapsed && <span>My Projects</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isOnProjectDetail && !collapsed && (
              <>
                <div ref={switcherRef} className="relative px-0.5">
                  <button
                    type="button"
                    onClick={openSwitcher}
                    className="w-full border border-[#E6E6E9] rounded-[11px] bg-gradient-to-b from-white to-[#FBFBFC] px-2.5 py-2 flex items-center gap-2.5 text-left hover:border-[#E7C6B8] transition-colors shadow-[0_4px_14px_rgba(20,20,23,0.03)]"
                  >
                    <span className="w-[29px] h-[29px] rounded-[8px] bg-gradient-to-br from-[#FF7638] to-[#EB5A1E] text-white flex items-center justify-center shrink-0 shadow-[0_7px_16px_rgba(235,90,30,0.16)]">
                      <FolderKanban className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-[10.5px] font-bold text-[#17171A] truncate"
                        title={currentProject?.name || currentProjectSlug || ""}
                      >
                        {currentProject?.name || currentProjectSlug}
                      </span>
                      <span className="block text-[8.5px] text-[#8B8B92] mt-px truncate">
                        {(currentProject?.clients as any)?.name || "Project"}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-[#9A9AA0] shrink-0 transition-transform ${
                        switcherOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {switcherOpen &&
                    switcherRect &&
                    createPortal(
                      <div
                        id="client-project-switcher-menu"
                        style={{
                          position: "fixed",
                          top: switcherRect.top,
                          left: switcherRect.left,
                          width: switcherRect.width,
                          zIndex: 100,
                        }}
                        className="bg-white border border-[#E0E0E4] rounded-[13px] shadow-[0_18px_45px_rgba(20,20,25,0.14)] p-1.5 max-h-64 overflow-y-auto"
                      >
                        {clientProjects.length === 0 ? (
                          <div className="px-2 py-3 text-[10px] text-[#8B8B92] text-center">No projects available</div>
                        ) : (
                          clientProjects.map((p) => {
                            const active = toSlug(p.name) === currentProjectSlug;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSwitcherOpen(false);
                                  setOpenMobile(false);
                                  navigate(`/projects/${toSlug(p.name)}?tab=${currentTab}`);
                                }}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-[7px] text-left transition-colors ${
                                  active ? "bg-[#FFF4EE]" : "hover:bg-[#F7F7F8]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    active ? "bg-[#EB5A1E]" : "bg-[#D0D0D5]"
                                  }`}
                                />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className="block text-[9.5px] font-semibold text-[#17171A] truncate"
                                    title={p.name}
                                  >
                                    {p.name}
                                  </span>
                                  <span className="block text-[8px] text-[#909097] mt-px truncate">
                                    {(p.clients as any)?.name || "No Client"}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>,
                      document.body
                    )}
                </div>

                {CLIENT_NAV_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1 pt-1">
                    <div className="px-2 text-[9px] font-semibold text-[#A1A1A8] tracking-[0.03em] uppercase">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = currentTab === item.value;
                        const count = getNavCount(item.countKey);
                        const Icon = item.icon;
                        return (
                          <div key={item.value} className="relative">
                            {active && (
                              <div className="absolute -left-[7px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#EB5A1E]" />
                            )}
                            <NavLink
                              to={`/projects/${currentProjectSlug}?tab=${item.value}`}
                              onClick={() => setOpenMobile(false)}
                              className={`flex items-center gap-2 h-[34px] px-2.5 rounded-[9px] text-[10.5px] transition-colors ${
                                active
                                  ? "text-[#EB5A1E] font-semibold bg-[#FFF4EE]"
                                  : "text-[#74747B] hover:text-[#4A4A50] hover:bg-[#FAFAFA]"
                              }`}
                            >
                              <Icon
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  active ? "text-[#EB5A1E]" : "text-[#9A9AA0]"
                                }`}
                              />
                              <span className="truncate flex-1">{item.label}</span>
                              {count != null && (
                                <span
                                  className={`text-[9px] font-semibold rounded-full min-w-[18px] h-[16px] px-1 flex items-center justify-center ${
                                    active
                                      ? "bg-[#EB5A1E]/15 text-[#EB5A1E]"
                                      : "bg-[#F3F3F5] text-[#8B8B92]"
                                  }`}
                                >
                                  {count}
                                </span>
                              )}
                            </NavLink>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          sections.map((sec) => (
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

                    return (
                      <SidebarMenuItem key={item.title} className="relative">
                        {isActive && (
                          <div className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] bg-[#EB5A1E] z-10" />
                        )}
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
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-black/5 mt-auto">
        {!collapsed ? (
          <div className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-2.5 p-2 rounded-[10px] border border-[#E6E6E9] ${
                isClient
                  ? "bg-gradient-to-b from-white to-[#FBFBFC] shadow-[0_5px_16px_rgba(20,20,23,0.03)]"
                  : "bg-white"
              }`}
            >
              <div
                className={`w-8 h-8 shrink-0 flex items-center justify-center font-bold text-[12.5px] ${
                  isClient
                    ? "rounded-[10px] bg-gradient-to-br from-[#FF7A3D] to-[#EB5A1E] text-white shadow-[0_6px_16px_rgba(235,90,30,0.2)]"
                    : "rounded-full bg-[#DFF6E4] text-[#1FAA59]"
                }`}
              >
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
