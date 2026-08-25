import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export interface EmployeeProjectsTabProps {
  employeeProjects: any[];
}

export function EmployeeProjectsTab({ employeeProjects }: EmployeeProjectsTabProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Project Assignments</h3>
      {employeeProjects.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
          This employee is not currently assigned to any active projects.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employeeProjects.map((project: any) => (
            <div key={project.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-black">{project.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">Role: <span className="text-foreground capitalize">{project.project_role || "Member"}</span></p>
                </div>
                <Badge variant={project.status === "active" ? "default" : "secondary"} className="capitalize">
                  {project.status}
                </Badge>
              </div>
              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                Assigned on: {format(new Date(project.assigned_at), "MMM d, yyyy")}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
