import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, ArrowRight, Building, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toSlug } from "@/lib/utils";
import { TruncatedTitle } from "@/components/ui/truncated-title";

export interface MyProjectsWidgetProps {
  projects: any[];
}

export function MyProjectsWidget({ projects }: MyProjectsWidgetProps) {
  const navigate = useNavigate();

  return (
    <Card className="p-5 border border-black/[0.08] dark:border-white/[0.08] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-foreground" />
          <h2 className="text-base font-bold tracking-tight text-foreground">
            My Active Projects
          </h2>
          <Badge variant="secondary" className="text-xs font-semibold">
            {projects.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Assigned commitments & planned allocation
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          You are not currently assigned to any active projects.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((item: any) => {
            const project = item.projects;
            if (!project) return null;
            const roleName = item.project_roles?.name || "Member";
            const alloc = Number(item.allocation_percentage) || 100;
            const projectSlug = toSlug(project.name || project.id);

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/projects/${projectSlug}`)}
                className="p-4 bg-background border border-black/[0.08] dark:border-white/[0.08] rounded-xl hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <TruncatedTitle
                      text={project.name}
                      className="text-sm font-bold text-foreground group-hover:text-[#EB5A1E] transition-colors line-clamp-1"
                    />
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 font-semibold ${
                        project.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {project.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <Building className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {project.clients?.name || "Internal Project"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block">
                      Role: <strong className="text-foreground">{roleName}</strong>
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Allocation: <strong className="text-foreground">{alloc}%</strong>
                    </span>
                  </div>

                  <span className="text-[#EB5A1E] font-semibold text-xs flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Workspace <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
