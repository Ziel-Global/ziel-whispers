import { supabase } from "@/integrations/supabase/client";

export type TaskType = {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

/**
 * Fetches available task types for a project.
 * Combines organization default types (project_id IS NULL) with project-specific custom types.
 */
export async function getTaskTypes(projectId: string | null): Promise<TaskType[]> {
  try {
    let query = supabase.from("task_types" as any).select("*");

    if (projectId) {
      query = query.or(`project_id.eq.${projectId},project_id.is.null`);
    } else {
      query = query.is("project_id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching task types:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      color: row.color || "bg-gray-100 text-gray-800",
      created_at: row.created_at,
    }));
  } catch (error) {
    console.error("Failed to load task types:", error);
    return [];
  }
}

/**
 * Creates a new task type (organization default or project custom).
 */
export async function createTaskType(type: {
  project_id?: string | null;
  name: string;
  description?: string | null;
  color?: string;
}): Promise<TaskType> {
  const { data, error } = await supabase
    .from("task_types" as any)
    .insert({
      project_id: type.project_id || null,
      name: type.name,
      description: type.description || null,
      color: type.color || "bg-gray-100 text-gray-800",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task type "${type.name}": ${error.message}`);
  }

  return {
    id: (data as any).id,
    project_id: (data as any).project_id,
    name: (data as any).name,
    description: (data as any).description,
    color: (data as any).color,
    created_at: (data as any).created_at,
  };
}
