/** Active (clocked in, not clocked out) first, then clocked out, then absent; A–Z by name within each group. */
export function sortPresentFirst<
  T extends {
    clock_in?: string | null;
    clock_out?: string | null;
    users?: { full_name?: string | null } | null;
  }
>(rows: T[]): T[] {
  const getRank = (r: T) => {
    if (r.clock_in && !r.clock_out) return 0; // Active
    if (r.clock_in) return 1;                 // Clocked out (On Time / Late)
    return 2;                                 // Absent
  };
  return [...rows].sort((a, b) => {
    const rankDiff = getRank(a) - getRank(b);
    if (rankDiff !== 0) return rankDiff;
    return (a.users?.full_name || "").localeCompare(b.users?.full_name || "");
  });
}
