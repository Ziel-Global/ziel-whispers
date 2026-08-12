export interface TestResultEntry {
  testId: string;
  testName: string;
  date: string;
  status: "PASS" | "FAIL";
  notes?: string;
}

class TestReporter {
  private results: TestResultEntry[] = [];

  public logResult(entry: Omit<TestResultEntry, "date">) {
    const fullEntry: TestResultEntry = {
      ...entry,
      date: new Date().toISOString().split("T")[0],
    };
    this.results.push(fullEntry);
    console.log(
      `[TEST REPORT] ${fullEntry.testId} - ${fullEntry.testName}: ${fullEntry.status} ${fullEntry.notes ? `(${fullEntry.notes})` : ""}`,
    );
  }

  public getResults(): TestResultEntry[] {
    return this.results;
  }

  public printMarkdownTable() {
    console.log("\n=========================================================");
    console.log("                AUTOMATED TEST RESULTS LOG                ");
    console.log("=========================================================");
    console.log("| Test # | Test Name | Date | Pass / Fail | Notes |");
    console.log("| :---: | :--- | :---: | :---: | :--- |");
    for (const r of this.results) {
      console.log(
        `| **${r.testId}** | ${r.testName} | ${r.date} | ${r.status} | ${r.notes || ""} |`,
      );
    }
    console.log("=========================================================\n");
  }
}

export const reporter = new TestReporter();
