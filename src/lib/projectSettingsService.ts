import { supabase } from "@/integrations/supabase/client";

/**
 * Service to resolve key-value project settings with organization-level fallback.
 * Hierarchy:
 * 1. Project-specific setting (project_id = projectId AND key = key)
 * 2. Organization default setting (project_id IS NULL AND key = key)
 * 3. System hardcoded default fallback
 */
export async function getProjectSetting<T = any>(
  projectId: string | null,
  key: string,
  defaultValue: T
): Promise<T> {
  try {
    // Attempt RPC call first for single atomic lookup
    const { data: rpcValue, error: rpcError } = await (supabase.rpc as any)(
      "get_project_setting",
      {
        p_project_id: projectId,
        p_key: key,
        p_default: defaultValue,
      }
    );

    if (!rpcError && rpcValue !== null && rpcValue !== undefined) {
      return rpcValue as T;
    }

    // Direct table query fallback (if RPC is unavailable in local dev)
    if (projectId) {
      const { data: projectRow } = await supabase
        .from("project_settings_kv" as any)
        .select("value")
        .eq("project_id", projectId)
        .eq("key", key)
        .maybeSingle();

      if (projectRow?.value !== undefined && projectRow.value !== null) {
        return projectRow.value as T;
      }
    }

    // Query organization default
    const { data: orgRow } = await supabase
      .from("project_settings_kv" as any)
      .select("value")
      .is("project_id", null)
      .eq("key", key)
      .maybeSingle();

    if (orgRow?.value !== undefined && orgRow.value !== null) {
      return orgRow.value as T;
    }

    return defaultValue;
  } catch (error) {
    console.warn(`Failed to resolve setting key "${key}" for project "${projectId}":`, error);
    return defaultValue;
  }
}

/**
 * Upserts a project or organization setting key-value pair.
 * If projectId is null, sets organization-wide default.
 */
export async function setProjectSetting(
  projectId: string | null,
  key: string,
  value: any
): Promise<void> {
  const { error } = await supabase
    .from("project_settings_kv" as any)
    .upsert(
      {
        project_id: projectId,
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), key",
      }
    );

  if (error) {
    throw new Error(`Failed to set project setting "${key}": ${error.message}`);
  }
}
