import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProjectActivityFeed } from "@/lib/projectActivityFeed";

afterEach(() => vi.useRealTimers());

describe("project activity feed", () => {
  it("combines overdue tasks, blockers, completed work, updates, sprints, and team joins", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));

    const feed = buildProjectActivityFeed({
      workflowStatuses: [{ id: "done", category: "done" }],
      tasks: [
        { id: "late", title: "Late task", due_date: "2026-10-18", status_id: "active" },
        { id: "complete", title: "Finished task", status_id: "done", completed_at: "2026-10-19T11:00:00Z" },
      ],
      openBlockers: [{ description: "Waiting on approval" }],
      statusUpdates: [{ id: "su1", summary: "Weekly update", created_at: "2026-10-19T10:00:00Z" }],
      sprints: [{ id: "s1", name: "Sprint 1", status: "completed", end_date: "2026-10-18" }],
      resourceMembers: [{ id: "m1", assigned_at: "2026-10-19T09:00:00Z", users: { full_name: "Amina" } }],
    });

    expect(feed.map(({ key }) => key)).toEqual([
      "blocker-0-Waiting on approval", "done-complete", "su-su1", "member-m1", "overdue-late", "sprint-done-s1",
    ]);
    expect(feed.find(({ key }) => key === "overdue-late")?.text).toBe('"Late task" is overdue');
  });

  it("sorts newest first and applies a positive result limit", () => {
    const feed = buildProjectActivityFeed({
      statusUpdates: [
        { id: "old", summary: "Old", created_at: "2026-10-17T12:00:00Z" },
        { id: "new", summary: "New", created_at: "2026-10-19T12:00:00Z" },
      ],
      limit: 1,
    });

    expect(feed.map(({ key }) => key)).toEqual(["su-new"]);
  });

  it("does not cap the feed for zero or omitted limits", () => {
    const input = {
      statusUpdates: [
        { id: "a", summary: "A", created_at: "2026-10-19T12:00:00Z" },
        { id: "b", summary: "B", created_at: "2026-10-18T12:00:00Z" },
      ],
    };

    expect(buildProjectActivityFeed({ ...input, limit: 0 })).toHaveLength(2);
    expect(buildProjectActivityFeed(input)).toHaveLength(2);
  });
});
