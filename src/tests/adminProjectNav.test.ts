import { describe, expect, it } from "vitest";
import { ADMIN_PRIMARY_TABS, defaultTabForPrimary, healthPill, primaryFromTab } from "@/lib/adminProjectNav";

describe("admin project navigation", () => {
  it("maps nested tabs to their primary navigation section", () => {
    expect(primaryFromTab("tasks")).toBe("Work");
    expect(primaryFromTab("sprints")).toBe("Planning");
    expect(primaryFromTab("resources")).toBe("People");
    expect(primaryFromTab("automation-run-history")).toBe("Automation");
    expect(primaryFromTab("unrecognized")).toBe("Overview");
  });

  it("chooses a sensible first child tab for each primary section", () => {
    expect(defaultTabForPrimary("Overview")).toBe("overview");
    expect(defaultTabForPrimary("Work")).toBe("tasks");
    expect(defaultTabForPrimary("Planning")).toBe("phases");
    expect(defaultTabForPrimary("People")).toBe("resources");
    expect(defaultTabForPrimary("Activity")).toBe("status-updates");
    expect(defaultTabForPrimary("Insights")).toBe("stats");
    expect(defaultTabForPrimary("Automation")).toBe("automation-rules");
  });

  it("defines all primary sections exactly once", () => {
    expect(ADMIN_PRIMARY_TABS.map(({ key }) => key)).toEqual([
      "Overview", "Work", "Planning", "People", "Activity", "Insights", "Automation",
    ]);
  });

  it("maps known health values and gives unknown values a readable fallback", () => {
    expect(healthPill("at_risk").label).toBe("At Risk");
    expect(healthPill(null).label).toBe("Not Assessed");
    expect(healthPill("waiting_for_client").label).toBe("Waiting For Client");
  });
});
