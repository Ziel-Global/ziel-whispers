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
  Search,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/constants";
import { useSidebar } from "@/components/ui/sidebar";
import zielLogoWhite from "@/assets/ziel-logo-white.png";
import { cn, getAvatarUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* ─── Nav definitions ─────────────────────────────────────────────────────── */

const adminNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Active Users", url: "/employees", icon: Users },
  { title: "Attendance", url: "/attendance", icon: Clock },
  { title: "Daily Logs", url: "/logs/all", icon: FileText },
  { title: "Leave", url: "/leave/requests", icon: Calendar },
  { title: "Clients", url: "/clients", icon: Briefcase },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
];

const adminToolsNav = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Workflow", url: "/workflow-templates", icon: GitBranch },
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
  { title: "Leave & Requests", url: "/leave/my", icon: CalendarCheck },
  { title: "My Projects", url: "/my-projects", icon: FolderKanban },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Profile", url: "/profile", icon: User },
];

const clientNav = [{ title: "Projects", url: "/projects", icon: FolderKanban }];
const portalNav = [{ title: "Projects", url: "/portal", icon: FolderKanban }];

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AppSidebar() {
  const { profile, user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const role = profile?.role;
  const isClient =
    profile?.designation === "Client" ||
    profile?.designation === "Client Member";
  const isPortal =
    profile?.role === "client portal" ||
    profile?.designation === "Client Portal";
  const isAdminOrManager = role === "admin" || role === "manager";
  const isAdmin = role === "admin";
  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const mainItems = isPortal
    ? portalNav
    : isClient
      ? clientNav
      : role === "admin"
        ? adminNav
        : role === "manager"
          ? managerNav
          : employeeNav;

  /* ── Project sub-nav (client / portal) ── */
  const projectMatch = location.pathname.match(/^\/(projects|portal)\/([^/]+)/);
  const [projectsSubOpen, setProjectsSubOpen] = useState(false);
  const currentProjectSlug = projectMatch?.[2] || null;
  const isOnProjectDetail = (isClient || isPortal) && !!currentProjectSlug;
  const currentTab =
    new URLSearchParams(location.search).get("tab") || "overview";
  const clientProjectNav = [
    { label: "Overview", value: "overview" },
    { label: "Phase Progress", value: "phase-progress" },
    { label: "Tasks", value: "tasks" },
    { label: "Blockers", value: "blockers" },
    { label: "Project Updates", value: "status-updates" },
    { label: "Action Items", value: "action-items" },
    { label: "People", value: "people" },
  ];
  useEffect(() => {
    if (isOnProjectDetail) setProjectsSubOpen(true);
  }, [isOnProjectDetail]);

  /* ── Badges ── */
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
      const lastSeen =
        localStorage.getItem(`leave_last_seen_${user!.id}`) ||
        "2000-01-01T00:00:00Z";
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
    if (title === "Leave & Requests" && !isAdminOrManager)
      return employeeUnseenCount || 0;
    return 0;
  };

  const isItemActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  /* ─── Nav item renderer ──────────────────────────────────────────────────── */
  const renderNavItem = (item: {
    title: string;
    url: string;
    icon: React.ElementType;
  }) => {
    const badgeCount = getBadgeCount(item.title);
    const showBadge = badgeCount > 0;
    const isActive = isItemActive(item.url);
    const Icon = item.icon;
    const isProjectsItem = item.title === "Projects" && (isClient || isPortal);

    if (isProjectsItem) {
      return (
        <div key={item.title}>
          <button
            onClick={() => setProjectsSubOpen(!projectsSubOpen)}
            className={cn(
              "relative w-full flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] transition-all duration-150",
              isActive
                ? "bg-white text-gray-900 font-semibold shadow-sm"
                : "text-gray-500 font-medium hover:text-gray-700 hover:bg-white/60",
            )}
          >
            {/* Active left accent bar */}
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[hsl(21,83%,53%)] rounded-md" />
            )}
            <Icon
              className={cn(
                "h-[15px] w-[15px] shrink-0",
                isActive ? "text-[hsl(21,83%,53%)]" : "text-gray-400",
              )}
            />
            {!collapsed && (
              <span className="flex-1 text-left">{item.title}</span>
            )}
          </button>

          {!collapsed && projectsSubOpen && isOnProjectDetail && (
            <div className="ml-8 mt-0.5 space-y-px border-l border-gray-200 pl-3">
              {clientProjectNav.map((sub) => (
                <NavLink
                  key={sub.value}
                  to={`/${isPortal ? "portal" : "projects"}/${currentProjectSlug}?tab=${sub.value}`}
                  className={cn(
                    "block text-[12px] py-1.5 px-2 rounded-md transition-colors duration-100",
                    currentTab === sub.value
                      ? "text-[hsl(21,83%,44%)] font-semibold"
                      : "text-gray-400 hover:text-gray-600",
                  )}
                >
                  {sub.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.title}
        to={item.url}
        end={item.url === "/"}
        className={cn(
          "relative flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] transition-all duration-150",
          isActive
            ? "bg-white text-gray-900 font-semibold shadow-sm"
            : "text-gray-500 font-medium hover:text-gray-700 hover:bg-white/60",
        )}
      >
        {/* Active left accent bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[hsl(21,83%,53%)] rounded-md" />
        )}
        <Icon
          className={cn(
            "h-[15px] w-[15px] shrink-0 transition-colors",
            isActive ? "text-[hsl(21,83%,53%)]" : "text-gray-400",
          )}
        />
        {!collapsed && (
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="truncate">{item.title}</span>
            {showBadge && (
              <span className="ml-auto shrink-0 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-md px-1.5 py-px min-w-[20px] text-center leading-tight">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </span>
        )}
        {/* Collapsed badge dot */}
        {collapsed && showBadge && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-md" />
        )}
      </NavLink>
    );
  };

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out",
        "bg-[#F8F9FA] border-r border-gray-200",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      {/* ── LOGO CARD ── */}
      <div
        className={cn(
          "flex items-center shrink-0 border-b border-gray-200",
          collapsed
            ? "px-3 py-[14px] justify-center"
            : "px-3 py-[14px] gap-2.5",
        )}
      >
        {/* Logo icon */}
        <div className="w-7 h-7 rounded-md bg-[hsl(21,83%,53%)] flex items-center justify-center shrink-0">
          <img
            src={zielLogoWhite}
            alt="Ziel"
            className="w-4 h-4 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Company info */}
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-[13px] font-bold leading-tight truncate">
                Ziel
              </p>
              <p className="text-gray-400 text-[11px] leading-tight">
                Admin Console
              </p>
            </div>
            {/* Collapse toggle — inline with logo row, reference style */}
            <button
              onClick={toggleSidebar}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {/* Collapsed — expand button replaces the logo row toggle */}
        {collapsed && <></>}
      </div>

      {/* Collapsed: expand trigger below logo */}
      {collapsed && (
        <button
          onClick={toggleSidebar}
          className="mx-auto mt-2 w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
          title="Expand sidebar"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* ── SEARCH ── */}
      <div
        className={cn(
          "shrink-0",
          collapsed ? "px-2 pt-2 pb-1" : "px-3 pt-3 pb-1",
        )}
      >
        {!collapsed ? (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full h-8 pl-7 pr-10 rounded-lg text-[12px]",
                "bg-white border border-gray-200",
                "text-gray-700 placeholder:text-gray-300",
                "focus:outline-none focus:border-gray-300",
                "transition-colors duration-150",
              )}
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-px text-[9px] text-gray-300 font-sans pointer-events-none">
              <span className="text-[10px]">⌘</span>
              <span>K</span>
            </kbd>
          </div>
        ) : (
          <button
            onClick={toggleSidebar}
            className="w-full h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
            title="Search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── SCROLLABLE NAV ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4">
        {/* MAIN MENU */}
        <div>
          {!collapsed && (
            <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-[0.1em] px-3 mb-1">
              Main Menu
            </p>
          )}
          <nav className="space-y-px">
            {mainItems.map((item) => renderNavItem(item))}
          </nav>
        </div>

        {/* TOOLS — admin only */}
        {isAdmin && (
          <div>
            {!collapsed && (
              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-[0.1em] px-3 mb-1">
                Tools
              </p>
            )}
            {collapsed && <div className="h-px bg-gray-100 mx-2 mb-2" />}
            <nav className="space-y-px">
              {adminToolsNav.map((item) => renderNavItem(item))}
            </nav>
          </div>
        )}
      </div>

      {/* ── BOTTOM AREA ── */}
      <div className="shrink-0 px-3 pt-2 pb-3 space-y-3">
        {/* Settings — shown for non-admin (admin has it in Tools) */}
        {!isAdmin && (
          <NavLink
            to="/settings"
            className={cn(
              "relative flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150",
              isItemActive("/settings")
                ? "bg-white text-gray-900 font-semibold shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/60",
            )}
            title="Settings"
          >
            {isItemActive("/settings") && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[hsl(21,83%,53%)] rounded-md" />
            )}
            <Settings
              className={cn(
                "h-[15px] w-[15px] shrink-0",
                isItemActive("/settings")
                  ? "text-[hsl(21,83%,53%)]"
                  : "text-gray-400",
              )}
            />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        )}

        <div
          className={cn(
            "flex items-center gap-3 p-2 bg-white rounded-[12px] border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors",
            collapsed && "justify-center px-1",
          )}
        >
          <Avatar className="h-10 w-10 shrink-0 bg-[#FFF4EA] text-[#EC6824]">
            <AvatarImage src={getAvatarUrl(profile?.avatar_url)} />
            <AvatarFallback className="bg-transparent text-inherit text-[13px] font-bold tracking-tight">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 leading-tight truncate">
                  {profile?.full_name}
                </p>
                <p className="text-[11px] text-gray-500 leading-tight truncate capitalize">
                  {profile?.role === "admin"
                    ? "Super Admin"
                    : profile?.role || "User"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            </>
          )}
        </div>

        {!collapsed && (
          <div className="text-center text-[10px] font-medium text-gray-400/80 pb-1">
            v{APP_VERSION}
          </div>
        )}
      </div>
    </aside>
  );
}
