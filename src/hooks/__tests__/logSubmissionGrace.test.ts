import { describe, it, expect } from "vitest";
import { isLogSubmissionLate } from "@/hooks/useWorkSettings";

describe("log submission grace (shift end 19:00, 5 min)", () => {
  const late = (t: string) => isLogSubmissionLate(`2026-11-06T${t}+05:00`, "19:00", "2026-11-06");

  it("on time up to 7:05:59 pm", () => {
    expect(late("19:00:00")).toBe(false);
    expect(late("19:05:00")).toBe(false);
    expect(late("19:05:59")).toBe(false);
  });

  it("late from 7:06 pm", () => {
    expect(late("19:06:00")).toBe(true);
    expect(late("19:30:00")).toBe(true);
  });
});
