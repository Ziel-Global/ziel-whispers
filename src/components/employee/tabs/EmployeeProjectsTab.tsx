/**
 * Admin user-detail — Projects tab (ud-* Project Assignments from zielAdmin mock).
 *
 * IMPLEMENTED (wired):
 *   - Assignments card: title, subtitle, “N active assignments” badge
 *   - Project cards: name, role, status badge, Client / Assigned / Logged meta
 *   - Client from projects.clients; logged hours = all-time daily_logs sum per project
 *
 * OMITTED FROM MOCK (do not invent values):
 *   - Allocation progress bar (ud-progress / ud-progress-fill)
 *   - Allocation % meta cell
 *   - Footer capacity alert (“Allocation is currently X% across N projects…”)
 *
 * REASON: project_members has no allocation field. Fake equal-split or 0% bars
 * would mislead capacity planning. When product adds allocation (column or
 * equivalent), restore bar + Allocation meta + alert and bind to real values.
 *
 * DEFERRED: page header chrome; card click-through to project detail
 */
import { useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface EmployeeProjectsTabProps {
  employeeProjects: any[];
}

function statusBadgeClass(status?: string) {
  if (status === "active") return "bg-[#DFF6E4] text-[#1B8A46]";
  if (status === "on_hold") return "bg-[#FDF3E3] text-[#A9720B]";
  if (status === "completed") return "bg-[#EAF3FF] text-[#1C6FC9]";
  return "bg-[#F1F1F3] text-[#66666D]";
}

function statusLabel(status?: string) {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EmployeeProjectsTab({ employeeProjects }: EmployeeProjectsTabProps) {
  const activeCount = useMemo(() => {
    const active = employeeProjects.filter((p) => p.status === "active").length;
    return active > 0 ? active : employeeProjects.length;
  }, [employeeProjects]);

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="flex items-start justify-between gap-3.5 mb-[17px] flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">
              Project Assignments
            </div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Current delivery responsibilities and allocation.
            </div>
          </div>
          <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap">
            {activeCount} active assignment{activeCount === 1 ? "" : "s"}
          </span>
        </div>

        {employeeProjects.length === 0 ? (
          <div className="py-10 px-4 text-center border border-dashed border-[#D8D8DD] rounded-xl bg-[#FCFCFD]">
            <div className="text-[11px] font-bold text-[#66666D]">No project assignments</div>
            <div className="text-[10px] text-[#9A9AA0] mt-1">
              This employee is not currently assigned to any projects.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {employeeProjects.map((project: any) => (
              <div
                key={project.id}
                className="border border-black/[0.08] rounded-xl p-[15px] bg-white min-w-0"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#2F2F34] truncate">
                      {project.name}
                    </div>
                    <div className="text-[11px] text-[#73737A] mt-[3px] capitalize">
                      {project.project_role || "Member"}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap shrink-0",
                      statusBadgeClass(project.status)
                    )}
                  >
                    {statusLabel(project.status)}
                  </span>
                </div>

                {/*
                  OMITTED: ud-progress allocation bar + Allocation % meta + capacity alert.
                  See file header — add when project_members (or equivalent) stores allocation.
                */}

                <div className="grid grid-cols-2 gap-2.5 mt-[13px] pt-3 border-t border-black/[0.06]">
                  <div className="min-w-0">
                    <div className="text-[9.5px] text-[#9B9BA2]">Client</div>
                    <div className="text-[11px] font-semibold text-[#4B4B52] mt-0.5 truncate">
                      {project.client_name || "—"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9.5px] text-[#9B9BA2]">Assigned</div>
                    <div className="text-[11px] font-semibold text-[#4B4B52] mt-0.5 truncate">
                      {project.assigned_at
                        ? format(new Date(project.assigned_at), "MMM d, yyyy")
                        : "—"}
                    </div>
                  </div>
                  <div className="min-w-0 col-span-2 sm:col-span-1">
                    <div className="text-[9.5px] text-[#9B9BA2]">Logged</div>
                    <div className="text-[11px] font-semibold text-[#4B4B52] mt-0.5 truncate">
                      {Number(project.logged_hours || 0)}h
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
