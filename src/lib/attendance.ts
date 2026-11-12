/** Present (clocked in) first, then absent; A–Z by name within each group. */
export function sortPresentFirst<T extends { clock_in?: string | null; users?: { full_name?: string | null } | null }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const presentDiff = Number(!!b.clock_in) - Number(!!a.clock_in);
    if (presentDiff !== 0) return presentDiff;
    return (a.users?.full_name || "").localeCompare(b.users?.full_name || "");
  });
}
