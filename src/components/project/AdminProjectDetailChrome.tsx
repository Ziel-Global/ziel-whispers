import { format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  BarChart2,
  BarChart3,
  Bolt,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Flag,
  History,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Settings,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_PRIMARY_TABS,
  ADMIN_SECONDARY,
  defaultTabForPrimary,
  healthPill,
  primaryFromTab,
  type AdminNavIcon,
  type AdminPrimaryKey,
} from "@/lib/adminProjectNav";

const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  active: { bg: "#DFF6E4", color: "#1B8A46" },
  on_hold: { bg: "#FFF1B8", color: "#A9720B" },
  completed: { bg: "#EAF3FF", color: "#1C6FC9" },
  archived: { bg: "#F5F5F6", color: "#8B8B92" },
};

const NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  check: Check,
  grid: LayoutGrid,
  flag: Flag,
  calendar: Calendar,
  bolt: Bolt,
  users: Users,
  building: Building2,
  activity: Activity,
  clock: Clock,
  trendUp: TrendingUp,
  chart: BarChart3,
  bars: BarChart2,
  truck: Truck,
  copy: Copy,
  history: History,
};

function labelStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export type AdminNavCounts = {
  tasks?: number;
  actionItems?: number;
  sprints?: number;
  resources?: number;
  clients?: number;
  automation?: number;
};

export type AdminProjectDetailChromeProps = {
  project: any;
  latestHealth: any;
  ownerName?: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBack: () => void;
  statusOptions: string[];
  changeStatus: (s: string) => void;
  onOpenSettings: () => void;
  onAddTask: () => void;
  onAddPhase: () => void;
  onAddSprint: () => void;
  onAddTeamMember: () => void;
  onAddClientMember: () => void;
  onAddActionItem: () => void;
  onArchive?: () => void;
  onExport?: () => void;
  counts?: AdminNavCounts;
};

export function AdminProjectDetailChrome({
  project,
  latestHealth,
  ownerName,
  activeTab,
  onTabChange,
  onBack,
  statusOptions,
  changeStatus,
  onOpenSettings,
  onAddTask,
  onAddPhase,
  onAddSprint,
  onAddTeamMember,
  onAddClientMember,
  onAddActionItem,
  onArchive,
  onExport,
  counts = {},
}: AdminProjectDetailChromeProps) {
  const primary = primaryFromTab(activeTab);
  const secondaries = ADMIN_SECONDARY[primary] || null;
  const health = healthPill(latestHealth?.health_status);
  const statusStyle = STATUS_PILL[project.status] || STATUS_PILL.archived;
  const clientName = (project.clients as any)?.name;

  const secondaryLabel = (s: (typeof ADMIN_SECONDARY)[string][number]) => {
    if (!s.countKey) return s.label;
    const n = counts[s.countKey];
    if (n == null) return s.label;
    return `${s.label} (${n})`;
  };

  const dateRange =
    project.start_date && project.end_date
      ? `${format(new Date(project.start_date), "MMM d")} – ${format(new Date(project.end_date), "MMM d, yyyy")}`
      : project.start_date
        ? `From ${format(new Date(project.start_date), "MMM d, yyyy")}`
        : null;

  const selectPrimary = (key: AdminPrimaryKey) => {
    if (key === primary) {
      if (key === "Overview") onTabChange("overview");
      return;
    }
    onTabChange(defaultTabForPrimary(key));
  };

  return (
    <>
      <div className="flex items-start gap-3.5 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 rounded-[10px] border border-black/[0.08] bg-white flex items-center justify-center shrink-0 hover:bg-[#F6F5F3] transition-colors"
          aria-label="Back to projects"
        >
          <ArrowLeft className="h-4 w-4 text-[#4B4B52]" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-bold tracking-[-0.5px] text-[#17171A] leading-tight m-0 whitespace-nowrap">
              {project.name}
            </h1>
            {clientName && (
              <span className="text-[13px] text-[#8B8B92] whitespace-nowrap">· {clientName}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-[7px] flex-wrap">
            <span
              className="text-[11.5px] font-bold px-2.5 py-[3px] rounded-full whitespace-nowrap"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {labelStatus(project.status)}
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-[3px] rounded-full whitespace-nowrap"
              style={{ background: health.bg, color: health.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: health.color }} />
              {health.label}
            </span>
            {dateRange && (
              <span className="text-[12.5px] text-[#8B8B92] whitespace-nowrap">{dateRange}</span>
            )}
            {ownerName && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#8B8B92] whitespace-nowrap">
                <span className="w-[18px] h-[18px] rounded-full bg-[#FDECE3] text-[#EB5A1E] inline-flex items-center justify-center font-bold text-[9px]">
                  {initials(ownerName)}
                </span>
                {ownerName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-2.5 rounded-[10px] hover:bg-[#d64f18] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                Add
                <ChevronDown className="h-[11px] w-[11px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px] rounded-[10px] p-1.5">
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={() => {
                  onTabChange("tasks");
                  onAddTask();
                }}
              >
                Add Task
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={() => {
                  onTabChange("action-items");
                  onAddActionItem();
                }}
              >
                Add Action Item
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={onAddTeamMember}
              >
                Add Team Member
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={() => {
                  onTabChange("clients");
                  onAddClientMember();
                }}
              >
                Add Client Member
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={() => {
                  onTabChange("phases");
                  onAddPhase();
                }}
              >
                Add Phase
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={() => {
                  onTabChange("sprints");
                  onAddSprint();
                }}
              >
                Add Sprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-[9px] text-[13px] font-semibold text-[#17171A] hover:bg-[#F6F5F3] transition-colors"
              >
                {labelStatus(project.status)}
                <ChevronDown className="h-3 w-3 text-[#8B8B92]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[150px] rounded-[10px] p-1.5">
              {statusOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                  onClick={() => changeStatus(opt)}
                >
                  {labelStatus(opt)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-[38px] w-[38px] rounded-[10px] border border-black/[0.08] bg-white flex items-center justify-center hover:bg-[#F6F5F3] transition-colors"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-[17px] w-[17px] text-[#4B4B52]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px] rounded-[10px] p-1.5">
              {onExport && (
                <DropdownMenuItem
                  className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                  onClick={onExport}
                >
                  Export Report
                </DropdownMenuItem>
              )}
              {onArchive && (
                <>
                  {onExport && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="rounded-[7px] text-[13px] font-medium text-[#E5484D] cursor-pointer"
                    onClick={onArchive}
                  >
                    Archive Project
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                className="rounded-[7px] text-[13px] font-medium text-[#4B4B52] cursor-pointer"
                onClick={onOpenSettings}
              >
                Project Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={onOpenSettings}
            className="h-[38px] w-[38px] rounded-[10px] border border-black/[0.08] bg-white flex items-center justify-center hover:bg-[#F6F5F3] transition-colors"
            title="Project Settings"
            aria-label="Project Settings"
          >
            <Settings className="h-4 w-4 text-[#4B4B52]" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-[15] bg-white -mx-1 px-1 pt-1">
        <div className="pt-3.5 pb-3.5">
          <div className="inline-flex items-center gap-1 overflow-x-auto max-w-full bg-[#F6F5F3] rounded-[11px] p-[5px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {ADMIN_PRIMARY_TABS.map((t) => {
              const active = primary === t.key;
              const Icon = NAV_ICONS[t.icon];
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectPrimary(t.key)}
                  className={`flex items-center gap-[7px] px-4 py-2 rounded-lg text-[13px] whitespace-nowrap flex-none transition-colors ${
                    active
                      ? "font-bold text-white bg-[#17171A]"
                      : "font-medium text-[#4B4B52] bg-transparent hover:bg-black/[0.04]"
                  }`}
                >
                  <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={active ? 2.4 : 2} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {secondaries && (
          <div className="flex items-center gap-[22px] border-b border-black/[0.08] overflow-x-visible">
            {secondaries.map((s) => {
              const active = activeTab === s.tab;
              const Icon = NAV_ICONS[s.icon];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onTabChange(s.tab)}
                  className={`flex items-center gap-[7px] py-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    active
                      ? "font-bold text-[#17171A] border-[#EB5A1E]"
                      : "font-medium text-[#8B8B92] border-transparent hover:text-[#4B4B52]"
                  }`}
                >
                  <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={active ? 2.4 : 2} />
                  {secondaryLabel(s)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
