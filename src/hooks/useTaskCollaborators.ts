import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TaskCollaborator {
  id: string;
  task_id: string;
  user_id: string;
  added_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export function useTaskCollaborators(taskId?: string) {
  const [collaborators, setCollaborators] = useState<TaskCollaborator[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const fetchCollaborators = useCallback(async () => {
    if (!taskId) {
      setCollaborators([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_collaborators')
        .select(`
          id,
          task_id,
          user_id,
          added_at,
          user:users!task_collaborators_user_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq('task_id', taskId);

      if (error) throw error;
      setCollaborators((data as unknown as TaskCollaborator[]) || []);
    } catch (err: any) {
      console.error('Error fetching task collaborators:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const addCollaborator = async (userId: string) => {
    if (!taskId) return false;

    try {
      const { error } = await supabase
        .from('task_collaborators')
        .insert({
          task_id: taskId,
          user_id: userId,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Already a Collaborator',
            description: 'This user is already added as a collaborator on this task.',
            variant: 'default',
          });
          return false;
        }
        throw error;
      }

      toast({
        title: 'Collaborator Added',
        description: 'Successfully added team member to task collaborators.',
      });
      await fetchCollaborators();
      return true;
    } catch (err: any) {
      console.error('Error adding collaborator:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to add collaborator.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const removeCollaborator = async (userId: string) => {
    if (!taskId) return false;

    try {
      const { error } = await supabase
        .from('task_collaborators')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Collaborator Removed',
        description: 'Collaborator removed from task.',
      });
      await fetchCollaborators();
      return true;
    } catch (err: any) {
      console.error('Error removing collaborator:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to remove collaborator.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    collaborators,
    loading,
    fetchCollaborators,
    addCollaborator,
    removeCollaborator,
  };
}
