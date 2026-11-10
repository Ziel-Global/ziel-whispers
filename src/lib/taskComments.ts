/** Row for task_comments, or null when there is nothing valid to save. Matches the RLS insert rule (own, human). */
export function buildTaskCommentInsert(taskId: string | undefined, authorId: string | undefined, body: string) {
  const text = body.trim();
  if (!taskId || !authorId || !text) return null;
  return { task_id: taskId, author_id: authorId, author_type: "human" as const, body: text };
}
