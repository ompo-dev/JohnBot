import { describe, expect, it } from "bun:test";
import { dashboardDemoProgram } from "../../src/lib/dashboard-demo";
import { validateDashboardProgram } from "../../src/contracts/dashboard-library";
import { operationsSchema } from "../../src/contracts/operations";

const mockState = operationsSchema.parse({
  mode: "simulation",
  revision: 1,
  viewerId: "person-1",
  people: [
    {
      id: "person-1",
      name: "Alice Operator",
      sectorIds: ["factory"],
      roleIds: [],
      reportsTo: [],
      goals: ["Optimize flow"],
    },
  ],
  sectors: [{ id: "factory", name: "Factory Floor", parentIds: [] }],
  roles: [],
  agentIds: [],
  rules: [],
  dashboards: [],
  notebooks: [],
  connectors: [],
  actions: [
    { id: "act-1", title: "Check machine", ownerId: "person-1", sectorIds: [], sourceRef: "test", status: "open", dueAt: null },
    { id: "act-2", title: "Clean filter", ownerId: "person-1", sectorIds: [], sourceRef: "test", status: "done", dueAt: null },
  ],
  deliveries: [],
  audit: [],
  dataset: {
    source: "test.csv",
    sha256: "test",
    records: 1200,
    rejected: 5,
    duplicates: 1,
    failures: 42,
    machines: [
      { group: "CNC-01", records: 600, failures: 20, failure_rate: 0.033 },
      { group: "CNC-02", records: 600, failures: 22, failure_rate: 0.036 },
    ],
  },
});

const mockRoutines = [
  {
    id: "wf-inspection",
    title: "Inspection Check",
    steps: 4,
    updatedAt: "2025-01-01T00:00:00Z",
    lastRun: { status: "done", at: "2025-01-01T00:00:00Z" },
  },
  {
    id: "wf-calibrate",
    title: "Calibration Run",
    steps: 2,
    updatedAt: "2025-01-02T00:00:00Z",
    lastRun: null,
  },
];

describe("dashboardDemoProgram unit tests", () => {
  it("generates program that passes validateDashboardProgram without args", () => {
    const program = dashboardDemoProgram();
    expect(typeof program).toBe("string");
    expect(() => validateDashboardProgram(program)).not.toThrow();
  });

  it("generates program that passes validateDashboardProgram with real state and routines", () => {
    const program = dashboardDemoProgram(mockState, mockRoutines as any, []);
    expect(typeof program).toBe("string");
    expect(() => validateDashboardProgram(program)).not.toThrow();
  });

  it("includes required queries, state bindings and tabs", () => {
    const program = dashboardDemoProgram(mockState, mockRoutines as any, []);
    expect(program).toContain('Query("dashboardData", { source: "quality" })');
    expect(program).toContain('Query("dashboardData", { source: "machines" })');
    expect(program).toContain('Query("dashboardData", { source: "routines" })');
    expect(program).toContain('Query("dashboardData", { source: "actions" })');
    expect(program).toContain('Query("dashboardData", { source: "person" })');
    expect(program).toContain('$machine = ""');
    expect(program).toContain('id: "overview"');
    expect(program).toContain('id: "machines"');
    expect(program).toContain('id: "routines"');
    expect(program).toContain('id: "actions"');
    expect(program).toContain('@Where(machines, "group", $machine)');
    expect(program).toContain('@Set($machine, "")');
    expect(program).toContain('@First(quality)');
    expect(program).toContain('@First(person)');
    expect(program).toContain('@Each(routines, "r", RoutineCard(r.id, r.title, r.lastRun.status, r.steps, r.lastRun.at, @OpenRoutine(r.id)))');
  });
});
