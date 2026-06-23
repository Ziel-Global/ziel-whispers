import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default function GoalsPage() {
  const navigate = useNavigate();

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: goalsProgress } = useQuery({
    queryKey: ["goals-progress"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("goal_id, status")
        .not("goal_id", "is", null);
      const stats: Record<string, { total: number; completed: number }> = {};
      (data || []).forEach((t) => {
        if (!stats[t.goal_id]) stats[t.goal_id] = { total: 0, completed: 0 };
        stats[t.goal_id].total++;
        if (t.status === "complete") stats[t.goal_id].completed++;
      });
      return stats;
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/"); }}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold tracking-tight">Project Goals</h1>
        </div>
        <Button onClick={() => navigate("/goals/new")} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Goal</Button>
      </div>

      <Card>
        {!goals || goals.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No goals yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Goal Name</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => (
                <TableRow
                  key={goal.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/goals/${goal.id}`)}
                >
                  <TableCell className="font-medium">{goal.title}</TableCell>
                  <TableCell className="text-muted-foreground">{(goal.projects as any)?.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              goalsProgress?.[goal.id]
                                ? (goalsProgress[goal.id].completed / goalsProgress[goal.id].total) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {goalsProgress?.[goal.id]
                          ? `${goalsProgress[goal.id].completed}/${goalsProgress[goal.id].total}`
                          : "0/0"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(goal.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{goal.due_date ? format(new Date(goal.due_date), "MMM d, yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
