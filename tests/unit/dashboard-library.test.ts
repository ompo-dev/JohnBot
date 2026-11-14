import { describe, expect, it } from "bun:test";
import {
  dashboardLibrary,
  dashboardLibraryPrompt,
  validateDashboardProgram,
  dashboardComponents,
  dashboardActions,
  dashboardFunctions,
} from "../../src/contracts/dashboard-library";

describe("dashboard-library contract", () => {
  it("exports dashboardLibrary with null components and correct metadata", () => {
    expect(dashboardLibrary).toBeDefined();
    expect(dashboardComponents.length).toBeGreaterThanOrEqual(25);
    for (const comp of dashboardComponents) {
      expect(comp.component).toBeNull();
      expect(typeof comp.name).toBe("string");
      expect(typeof comp.description).toBe("string");
    }
  });

  it("exports dashboardLibraryPrompt generated with bindings and builtin functions", () => {
    expect(typeof dashboardLibraryPrompt).toBe("string");
    expect(dashboardLibraryPrompt.length).toBeGreaterThan(100);
    expect(dashboardLibraryPrompt).toContain("Stack");
    expect(dashboardLibraryPrompt).toContain("Heading");
    expect(dashboardLibraryPrompt).toContain("Table");
    expect(dashboardLibraryPrompt).toContain("@Count");
    expect(dashboardLibraryPrompt).toContain("$binding");
  });

  it("registers custom actions and pure functions", () => {
    expect(dashboardActions.length).toBe(5);
    const actionNames = dashboardActions.map((a) => a.name);
    expect(actionNames).toContain("OpenRoutine");
    expect(actionNames).toContain("RunRoutine");
    expect(actionNames).toContain("OpenAgent");
    expect(actionNames).not.toContain("OpenNotebook");
    expect(actionNames).toContain("Navigate");
    expect(actionNames).toContain("Refresh");

    const funcNames = dashboardFunctions.map((f) => f.name);
    expect(funcNames).toContain("Where");
    expect(funcNames).toContain("Take");
    expect(funcNames).toContain("Percent");

    // Test function implementations
    const where = dashboardFunctions.find((f) => f.name === "Where")!;
    expect(where.fn({ rows: [{ a: 1 }, { a: 2 }, { a: 1 }], field: "a", value: 1 })).toEqual([
      { a: 1 },
      { a: 1 },
    ]);

    const take = dashboardFunctions.find((f) => f.name === "Take")!;
    expect(take.fn({ rows: [1, 2, 3, 4], count: 2 })).toEqual([1, 2]);

    const percent = dashboardFunctions.find((f) => f.name === "Percent")!;
    expect(percent.fn({ value: 0.856, decimals: 1 })).toBe("85.6%");
  });

  describe("validateDashboardProgram", () => {
    it("accepts valid nested programs", () => {
      const prog = `root=Stack([Heading("Dashboard Title"), Metric("Active Machines", 12)])`;
      expect(() => validateDashboardProgram(prog)).not.toThrow();
    });

    it("accepts valid Query calls with dashboardData source", () => {
      const prog = `
machines = Query("dashboardData", { source: "machines" })
root = Table(machines)
`;
      expect(() => validateDashboardProgram(prog)).not.toThrow();
    });

    it("rejects incomplete programs or syntax errors", () => {
      expect(() => validateDashboardProgram("root = Stack([")).toThrow();
    });

    it("rejects unknown components", () => {
      expect(() => validateDashboardProgram("root = UnknownWidget()")).toThrow(/Unknown component/);
    });

    it("rejects Mutation statements", () => {
      const prog = `
res = Mutation("updateMachine", { id: "m-1" })
root = Stack([])
`;
      expect(() => validateDashboardProgram(prog)).toThrow(/Mutation calls are forbidden/);
    });

    it("rejects unauthorized query tools", () => {
      const prog = `
data = Query("fetchUrl", { url: "https://example.com" })
root = Table(data)
`;
      expect(() => validateDashboardProgram(prog)).toThrow(/Invalid query tool/);
    });

    it("rejects invalid query source parameter", () => {
      const prog = `
data = Query("dashboardData", { source: "unauthorized_source" })
root = Table(data)
`;
      expect(() => validateDashboardProgram(prog)).toThrow(/Invalid query source/);
    });

    it("rejects programs exceeding max character length", () => {
      const hugeString = "a".repeat(65000);
      expect(() => validateDashboardProgram(hugeString)).toThrow(/exceeds maximum length/);
    });

    it("rejects unresolved references", () => {
      const prog = `
item = nonExistentVar
root = Table([item])
`;
      expect(() => validateDashboardProgram(prog)).toThrow(/Unresolved identifiers/);
    });
  });
});
