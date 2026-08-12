import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VersionCheckedTaskUpdate {
  taskId: string;
  expectedVersion: number;
  updates: Record<string, any>;
}

export function useTaskVersionCheck() {
  const { toast } = useToast();

  const updateTaskWithVersion = async ({
    taskId,
    expectedVersion,
    updates,
  }: VersionCheckedTaskUpdate): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      // Execute version-checked update
      const { data, error, count } = await supabase
        .from('tasks')
        .update({
          ...updates,
          version: expectedVersion + 1, // Automatically increment version
        })
        .eq('id', taskId)
        .eq('version', expectedVersion) // Must match current version in DB
        .select();

      if (error) {
        throw error;
      }

      // If no row was updated, it means another process incremented the version first
      if (!data || data.length === 0) {
        const conflictMessage =
          'Concurrency Conflict: This task was modified by another process or team member while you were editing. Please refresh to view the latest status.';

        toast({
          title: 'Conflict Detected',
          description: conflictMessage,
          variant: 'destructive',
        });

        return {
          success: false,
          error: conflictMessage,
        };
      }

      return {
        success: true,
        data: data[0],
      };
    } catch (err: any) {
      console.error('Error performing version-checked task update:', err);
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to update task.',
        variant: 'destructive',
      });
      return {
        success: false,
        error: err.message,
      };
    }
  };

  return { updateTaskWithVersion };
}
