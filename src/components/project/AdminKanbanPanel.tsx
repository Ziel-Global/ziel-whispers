import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  AdminWorkFilters,
  DEFAULT_ADMIN_WORK_FILTERS,
  filterAdminWorkTasks,
  type AdminWorkFilterState,
} from "@/components/project/AdminWorkFilters";
import { KanbanTaskCard } from "@/components/project/KanbanTaskCard";
import { getKanbanBoardStatuses, workflowStatusDotColor } from "@/lib/workflow";

type Props = {
  tasks: any[];
  sprints: any[];
  phases?: any[];
  workflowStatuses: any[];
  isAdmin?: boolean;
  setViewTaskData: (data: any) => void;
  setAddTaskOpen?: (b: boolean) => void;
  /** When false, hide admin work filters (client / simple views). Default true. */
  showFilters?: boolean;
  title?: string;
};

const MIN_BOARD_HEIGHT = 320;

/** Sizes the board to fill what's left of the page's scroll container, so only columns scroll. */
function useFillRemainingHeight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const board = ref.current;
    if (!board) return;
    let parent = board.parentElement;
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
    if (!parent) return;
    const scroller = parent;
    // Lock the page while the board is open: only columns (and the board sideways) scroll.
    // ponytail: on screens shorter than MIN_BOARD_HEIGHT the bottom of the board gets clipped.
    const prevOverflowY = scroller.style.overflowY;
    const prevOverscroll = scroller.style.overscrollBehavior;
    scroller.scrollTop = 0;
    scroller.style.overflowY = "hidden";
    scroller.style.overscrollBehavior = "none";

    const measure = () => {
      const top = board.getBoundingClientRect().top + scroller.scrollTop;
      let height = scroller.getBoundingClientRect().bottom - top;
      board.style.height = `${Math.max(MIN_BOARD_HEIGHT, height)}px`;
      // Trim whatever still overflows (page padding, content below the board).
      height -= scroller.scrollHeight - scroller.clientHeight;
      const next = `${Math.max(MIN_BOARD_HEIGHT, height)}px`;
      if (board.style.height !== next) board.style.height = next;
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      scroller.style.overflowY = prevOverflowY;
      scroller.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  return ref;
}

export function AdminKanbanPanel({
  tasks,
  sprints,
  phases = [],
  workflowStatuses,
  isAdmin = false,
  setViewTaskData,
  setAddTaskOpen,
  showFilters = true,
  title = "Kanban",
}: Props) {
  const [filters, setFilters] = useState<AdminWorkFilterState>(DEFAULT_ADMIN_WORK_FILTERS);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    (tasks || []).forEach((t: any) => {
      if (t.assigned_to && t.users?.full_name) map.set(t.assigned_to, t.users.full_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filtered = useMemo(
    () => (showFilters ? filterAdminWorkTasks(tasks, sprints, filters) : tasks || []),
    [tasks, sprints, filters, showFilters]
  );

  const columns = getKanbanBoardStatuses(workflowStatuses || []);
  const boardRef = useFillRemainingHeight();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
        <div className="text-[18px] font-bold text-[#17171A]">{title}</div>
        {isAdmin && setAddTaskOpen && (
          <button
            type="button"
            onClick={() => setAddTaskOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-2.5 rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Add Task
          </button>
        )}
      </div>

      {showFilters && (
        <AdminWorkFilters
          filters={filters}
          onChange={setFilters}
          phases={phases}
          sprints={sprints}
          workflowStatuses={workflowStatuses}
          assigneeOptions={assigneeOptions}
        />
      )}

      <div ref={boardRef} className="overflow-x-auto overflow-y-hidden overscroll-contain pb-2">
        <div
          className="grid gap-4 h-full items-start"
          style={{
            // Pin the row to the board height so each column scrolls on its own.
            gridTemplateRows: "minmax(0, 1fr)",
            gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 300px)`,
            minWidth: `${Math.max(columns.length, 1) * 300}px`,
          }}
        >
          {columns.map((status: any, colIdx: number) => {
            const cards = filtered.filter((t: any) => t.status_id === status.id);
            const dotColor = workflowStatusDotColor(status, colIdx);

            return (
              <div key={status.id} className="bg-[#F9F9F8] rounded-[14px] p-3.5 min-w-0 max-h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-[7px] text-[13px] font-bold text-[#17171A] whitespace-nowrap">
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ background: dotColor }}
                    />
                    {status.name.replace(/_/g, " ")}
                  </div>
                  <span className="bg-white border border-black/[0.08] rounded-full text-[11px] font-bold text-[#8B8B92] px-2 py-0.5 shrink-0">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 min-h-0 overflow-y-auto overscroll-contain">
                  {cards.length === 0 ? (
                    <p className="text-xs text-[#8B8B92] text-center py-8">No tasks</p>
                  ) : (
                    cards.map((t: any) => (
                      <KanbanTaskCard
                        key={t.id}
                        task={t}
                        sprints={sprints}
                        showProgressBar={status.category === "in_progress"}
                        onClick={() => setViewTaskData(t)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
