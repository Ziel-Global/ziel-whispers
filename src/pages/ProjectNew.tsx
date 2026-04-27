import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Required").max(200),
  description: z.string().optional(),
  client_id: z.string().min(1, "Required"),
  start_date: z.string().min(1, "Required"),
  end_date: z.string().optional(),
});

export default function ProjectNewPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ["clients-active"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: "", description: "", client_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "" } });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setSaving(true);
    try {
      const { data: project, error } = await supabase.from("projects").insert({
        name: data.name,
        description: data.description || null,
        client_id: data.client_id,
        start_date: data.start_date,
        end_date: data.end_date || null,
        created_by: profile?.id,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.created", target_entity: "projects", target_id: project.id });
      toast.success("Project created");
      navigate(`/projects/${project.id}`);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
      </div>
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Project Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="client_id" render={({ field }) => (
              <FormItem><FormLabel>Client *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                  <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem><FormLabel>Start Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="end_date" render={({ field }) => (
                <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="rounded-button">{saving ? "Creating…" : "Create Project"}</Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
