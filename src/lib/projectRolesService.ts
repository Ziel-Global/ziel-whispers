import { supabase } from "@/integrations/supabase/client";

export type ProjectRole = {
  id: string;
  project_id: string | null;
  name: string;
  permissions: Record<string, any>;
  created_at: string;
};

/**
 * Fetches all project-defined roles for a project (including global template roles).
 */
export async function getProjectRoles(projectId: string): Promise<ProjectRole[]> {
  const { data, error } = await supabase
    .from("project_roles")
    .select("*")
    .or(`project_id.eq.${projectId},project_id.is.null`);

  if (error) {
    console.error("Error fetching project roles:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    permissions: typeof row.permissions === "object" && row.permissions !== null ? row.permissions : {},
    created_at: row.created_at,
  }));
}

/**
 * Checks if a user has a specific permission in a project.
 * Permission keys can be dot-notated (e.g. "workflow.transition" or "tasks.delete").
 * Global 'admin' or 'manager' roles automatically bypass and return true.
 */
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permissionKey: string
): Promise<boolean> {
  try {
    // 1. Check user system role (Admin / Manager bypass)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (userData?.role === "admin" || userData?.role === "manager") {
      return true;
    }

    // 2. Query project membership role
    const { data: memberData } = await supabase
      .from("project_members")
      .select("project_role_id, project_roles(permissions)")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .is("removed_at", null)
      .maybeSingle();

    if (!memberData || !memberData.project_roles) {
      return false;
    }

    const permissions = (memberData.project_roles as any).permissions || {};
    return resolveNestedPermission(permissions, permissionKey);
  } catch (error) {
    console.error("Error checking project permission:", error);
    return false;
  }
}

/**
 * Updates the permissions JSONB object for a project role.
 */
export async function updateRolePermissions(
  roleId: string,
  permissions: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from("project_roles")
    .update({ permissions } as any)
    .eq("id", roleId);

  if (error) {
    throw new Error(`Failed to update role permissions: ${error.message}`);
  }
}

/**
 * Helper utility to traverse dot-notated permission keys (e.g., "workflow.transition").
 */
function resolveNestedPermission(permissions: Record<string, any>, keyPath: string): boolean {
  const parts = keyPath.split(".");
  let current: any = permissions;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return false;
    }
    current = current[part];
  }

  return Boolean(current);
}
