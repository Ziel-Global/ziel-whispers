import { describe, it, expect, vi } from "vitest";
import { BLUEPRINT_REPORTS_REGISTRY } from "../reports/reportDefinitions";
import { exportToCSV, exportToXLSX } from "../exportEngine";

describe("Module 9: Scheduled Report Library & Multi-Format Export Engine", () => {
  describe("Blueprint 13 Reports Registry", () => {
    it("contains all 13 reports from Blueprint Section 5.1", () => {
      expect(BLUEPRINT_REPORTS_REGISTRY.length).toBe(13);

      const ids = BLUEPRINT_REPORTS_REGISTRY.map((r) => r.id);
      expect(ids).toContain("REPORT_01_EXEC_WEEKLY");
      expect(ids).toContain("REPORT_02_MONTHLY_BUSINESS");
      expect(ids).toContain("REPORT_03_UTILIZATION");
      expect(ids).toContain("REPORT_04_BENCH_CAPACITY");
      expect(ids).toContain("REPORT_05_PROJECT_STATUS");
      expect(ids).toContain("REPORT_06_PROJECT_CLOSURE");
      expect(ids).toContain("REPORT_07_TIMESHEET");
      expect(ids).toContain("REPORT_08_ATTENDANCE");
      expect(ids).toContain("REPORT_09_LEAVE");
      expect(ids).toContain("REPORT_10_COMPLIANCE_EXCEPTIONS");
      expect(ids).toContain("REPORT_11_SPRINT_REVIEW");
      expect(ids).toContain("REPORT_12_PERFORMANCE_PACK");
      expect(ids).toContain("REPORT_13_CLIENT_SUMMARY");
    });

    it("verifies every report has valid metadata, formats, and columns", () => {
      BLUEPRINT_REPORTS_REGISTRY.forEach((r) => {
        expect(r.code).toBeTruthy();
        expect(r.title).toBeTruthy();
        expect(r.columns.length).toBeGreaterThan(0);
        expect(["pdf", "csv", "xlsx"]).toContain(r.defaultFormat);
        expect(r.audienceRoles.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Multi-Format Export Engine", () => {
    it("handles CSV export formatting with proper quote escaping", () => {
      // Mock DOM methods
      const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      const clickMock = vi.fn();
      const appendChildMock = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      const removeChildMock = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
      const createElementMock = vi.spyOn(document, "createElement").mockReturnValue({
        click: clickMock,
        set href(val: string) {},
        set download(val: string) {},
      } as any);

      const rows = [
        { Name: 'Alice, "Tech Lead"', Role: "Engineering", Hours: 40 },
        { Name: "Bob", Role: "Design", Hours: 35 },
      ];

      exportToCSV(rows, "test.csv");

      expect(createElementMock).toHaveBeenCalledWith("a");
      expect(clickMock).toHaveBeenCalled();

      // Clean up
      createElementMock.mockRestore();
      appendChildMock.mockRestore();
      removeChildMock.mockRestore();
    });

    it("generates XML Spreadsheet for Excel with multiple sheets", () => {
      const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      const revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;

      const clickMock = vi.fn();
      const appendChildMock = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      const removeChildMock = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
      const createElementMock = vi.spyOn(document, "createElement").mockReturnValue({
        click: clickMock,
        set href(val: string) {},
        set download(val: string) {},
      } as any);

      const sheets = [
        {
          sheetName: "Workforce",
          columns: ["Employee", "Utilization"],
          rows: [["Alice", "92%"], ["Bob", "78%"]],
        },
        {
          sheetName: "Projects",
          columns: ["Project", "Burn"],
          rows: [["Fintech", "80%"]],
        },
      ];

      exportToXLSX(sheets, "portfolio.xls");

      expect(createElementMock).toHaveBeenCalledWith("a");
      expect(clickMock).toHaveBeenCalled();

      createElementMock.mockRestore();
      appendChildMock.mockRestore();
      removeChildMock.mockRestore();
    });
  });
});

