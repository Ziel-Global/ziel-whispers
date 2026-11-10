const CLIENT_ROLES = ["client", "client member"];

/** Clients never clock in — keep them out of attendance management. */
export function excludeClientUsers<T extends { role?: string | null }>(users: T[]): T[] {
  return users.filter((u) => !CLIENT_ROLES.includes(u.role ?? ""));
}

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
