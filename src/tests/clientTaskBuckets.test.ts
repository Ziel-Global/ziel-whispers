import { describe, expect, it } from "vitest";
import { bucketTaskState, TASK_STATE_BUCKETS } from "@/lib/clientTaskBuckets";

describe("client portal task status buckets", () => {
  it.each([
    { status: { name: "Unlinked", category: "todo" }, expected: "Unlinked" },
    { status: { name: "In Development", category: "in_progress" }, expected: "Development" },
    { status: { name: "Complete", category: "done" }, expected: "Complete" },
    { status: { name: "Returned to Development", category: "todo" }, expected: "Returned" },
    { status: { name: "Custom Review", category: "custom" }, expected: "Development" },
    { status: undefined, expected: "Development" },
  ])("maps $status into the expected summary bucket", ({ status, expected }) => {
    expect(bucketTaskState(status)).toBe(expected);
  });

  it("exposes the four supported client summary buckets", () => {
    expect(TASK_STATE_BUCKETS).toEqual(["Unlinked", "Development", "Complete", "Returned"]);
  });
});
