import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toSlug } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClassicEditor } from "@/components/ui/classic-editor";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  client_id: z.string().min(1, "Client is required"),
  workflow_template_id: z.string().min(1, "Workflow template is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  baseline_end_date: z.string().optional(),
  budget_hours: z.string().optional(),
  billing_type: z.enum(["t_and_m", "fixed", "retainer", "internal"]),
  is_billable: z.boolean(),
  document_link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export default function ProjectNewPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-active"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["workflow-templates-list"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_templates").select("id, name").order("name");
      return data || [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      client_id: "",
      workflow_template_id: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      baseline_end_date: "",
      budget_hours: "",
      billing_type: "t_and_m",
      is_billable: true,
      document_link: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      const budgetVal = data.budget_hours ? Number(data.budget_hours) : null;

      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: data.name,
          description: data.description || null,
          client_id: data.client_id,
          start_date: data.start_date,
          end_date: data.end_date || null,
          baseline_end_date: data.baseline_end_date || data.end_date || null,
          budget_hours: budgetVal !== null && !isNaN(budgetVal) ? budgetVal : null,
          billing_type: data.billing_type,
          is_billable: data.is_billable,
          document_link: data.document_link || null,
          workflow_template_id: data.workflow_template_id,
          created_by: profile?.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "project.created",
        target_entity: "projects",
        target_id: project.id,
      });

      toast.success("Project created successfully");
      navigate(`/projects/${toSlug(data.name)}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/projects");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New Project</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure project scope, timeline baselines, and budget parameters.
          </p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm bg-card">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
            {/* 1. General Project Details */}
            <div className="space-y-4">
              <div className="pb-2 border-b">
                <h2 className="text-sm font-semibold text-foreground">1. Project Overview</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-xs font-semibold">Project Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Mobile Banking App" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Client *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workflow_template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Workflow Template *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-xs font-semibold">Description</FormLabel>
                      <FormControl>
                        <ClassicEditor
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Key deliverables, scope summary..."
                          variant="full"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 2. Timeline & Schedule Baseline */}
            <div className="space-y-4">
              <div className="pb-2 border-b">
                <h2 className="text-sm font-semibold text-foreground">2. Timeline & Baseline Target</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Start Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Target End Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            // Auto-populate baseline date if not manually edited
                            if (!form.getValues("baseline_end_date")) {
                              form.setValue("baseline_end_date", e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="baseline_end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold flex items-center justify-between">
                        <span>Baseline Date</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Slippage ref</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Contract/target deadline for Schedule Variance RAG.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 3. Budget & Commercial Model */}
            <div className="space-y-4">
              <div className="pb-2 border-b">
                <h2 className="text-sm font-semibold text-foreground">3. Budget & Commercial Model</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="billing_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Billing Type</FormLabel>
                      <Select
                        onValueChange={(val: any) => {
                          field.onChange(val);
                          if (val === "internal") {
                            form.setValue("is_billable", false);
                          } else {
                            form.setValue("is_billable", true);
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select billing type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="t_and_m">Time & Materials (T&M)</SelectItem>
                          <SelectItem value="fixed">Fixed Price</SelectItem>
                          <SelectItem value="retainer">Retainer</SelectItem>
                          <SelectItem value="internal">Internal Project</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budget_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold flex items-center justify-between">
                        <span>Budget Hours</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Capacity cap</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" placeholder="e.g. 160" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Used to track Project Burn % and over-budget warnings.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_billable"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2 flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-xs font-semibold">Billable Project</FormLabel>
                        <FormDescription className="text-[11px]">
                          Hours logged to this project count towards Billable Utilization %
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 4. External Documentation */}
            <div className="space-y-3 pt-1">
              <FormField
                control={form.control}
                name="document_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">
                      Document Link <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://drive.google.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/projects")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="font-semibold px-6">
                {saving ? "Creating…" : "Create Project"}
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
