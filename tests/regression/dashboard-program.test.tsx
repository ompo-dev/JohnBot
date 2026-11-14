import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { operationsSchema, type Operations } from "../../src/contracts/operations";
import type { WorkflowSummary } from "../../src/contracts/ipc-workflows";
import type { ClientAgentSummary } from "../../src/contracts/ipc-agents";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "CustomEvent",
  "MutationObserver",
  "HTMLInputElement",
  "HTMLFormElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "DocumentFragment",
  "getComputedStyle",
  "location",
  "history",
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: (dom.window as unknown as Record<string, unknown>)[name],
  });
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
dom.window.matchMedia = (() => ({matches:false,addEventListener(){},removeEventListener(){}})) as typeof window.matchMedia;
globalThis.ResizeObserver = class {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) { this.callback([{target,contentRect:new dom.window.DOMRect(0,0,600,300)}] as ResizeObserverEntry[],this as unknown as ResizeObserver); }
  unobserve() {}
  disconnect() {}
};

const { createRoot } = await import("react-dom/client");
const { DashboardProgram } = await import("../../src/features/operations/DashboardProgram");

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
      {
        id: "act-1",
        title: "Check machine filters",
        ownerId: "person-1",
        sectorIds: ["factory"],
        sourceRef: "test",
        status: "open",
        dueAt: null,
      },
      {
        id: "act-2",
        title: "Inspect bearings",
        ownerId: "person-1",
        sectorIds: ["factory"],
        sourceRef: "test",
        status: "done",
        dueAt: null,
      },
    ],
  deliveries: [],
  audit: [],
  dataset: {
    source: "test.csv",
    sha256: "test",
    records: 100,
    rejected: 0,
    duplicates: 0,
    failures: 10,
    machines: [{ group: "CNC Milling Machine", records: 100, failures: 10, failure_rate: 0.1 }],
  },
});

const mockRoutines: WorkflowSummary[] = [
  {
    id: "wf-1",
    title: "Daily Inspection",
    steps: 3,
    lastRun: null,
    status: "active",
  } as unknown as WorkflowSummary,
];

const mockAgents: ClientAgentSummary[] = [
  {
    id: "ag-1",
    name: "Diagnostic Agent",
    role: "Diagnostics",
    status: "idle",
    provider: { type: "local", model: "llama-3" },
  } as unknown as ClientAgentSummary,
];

describe("DashboardProgram regression & integration", () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    container = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    container.remove();
  });

  it("renders a real Gemini composition with original tabs, charts and tables", async () => {
    const fixture = process.env.JOHNBOT_DASHBOARD_FIXTURE
      ? await Bun.file(process.env.JOHNBOT_DASHBOARD_FIXTURE).json()
      : {program: await Bun.file(new URL("../fixtures/dashboard-generated.openui", import.meta.url)).text(),state:mockState,routines:mockRoutines,agents:mockAgents};
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args) => { errors.push(args); if (errors.length <= 3) original(...args); };
    try {
      await act(async () => root.render(<DashboardProgram program={fixture.program} state={operationsSchema.parse(fixture.state)} routines={fixture.routines} agents={fixture.agents} onAction={() => {}} />));
      await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
      expect(container.querySelector('[data-testid="dashboard-program-root"]')).not.toBeNull();
      expect(container.querySelector('.agent-usage-table, .agent-usage-totals, .agent-usage-trend')).not.toBeNull();
      expect(errors).toEqual([]);
    } finally { console.error = original; }
  });

  it("renders valid nested program with Stack, Heading and Metric", async () => {
    const program = `root=Stack([Heading("Factory Overview"), Metric("Efficiency", 98)])`;
    const onAction = mock(() => {});

    await act(async () => {
      root.render(
        <DashboardProgram
          program={program}
          state={mockState}
          routines={mockRoutines}
          agents={mockAgents}
          onAction={onAction}
        />,
      );
    });

    const stack = container.querySelector('[data-testid="openui-stack"]');
    expect(stack).not.toBeNull();
    const heading = container.querySelector('[data-testid="openui-heading"]');
    expect(heading?.textContent).toBe("Factory Overview");
    const metric = container.querySelector('[data-testid="openui-metric"]');
    expect(metric?.textContent).toContain("98");
  });

  it("displays error message and calls onError on invalid program", async () => {
    const onError = mock(() => {});
    const onAction = mock(() => {});

    await act(async () => {
      root.render(
        <DashboardProgram
          program="root=IllegalUnknownWidget()"
          state={mockState}
          routines={mockRoutines}
          agents={mockAgents}
          onAction={onAction}
          onError={onError}
        />,
      );
    });

    const errorBox = container.querySelector('[data-testid="dashboard-program-error"]');
    expect(errorBox).not.toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it("fetches data via Query dashboardData and renders Table", async () => {
    const program = `
machines = Query("dashboardData", { source: "machines" })
root = Stack([
  Heading("Machine Fleet"),
  Table(machines)
])
`;
    const onAction = mock(() => {});

    await act(async () => {
      root.render(
        <DashboardProgram
          program={program}
          state={mockState}
          routines={mockRoutines}
          agents={mockAgents}
          onAction={onAction}
        />,
      );
    });

    // Allow async tool resolution
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const table = container.querySelector(".agent-usage-table");
    expect(table).not.toBeNull();
    expect(table?.textContent).toContain("CNC Milling Machine");
  });

  it("handles field interactions with reactive Input state binding", async () => {
    const program = `
$search = "initial"
root = Stack([
  Input("search", $search),
  Text($search)
])
`;
    const onAction = mock(() => {});

    await act(async () => {
      root.render(
        <DashboardProgram
          program={program}
          state={mockState}
          routines={mockRoutines}
          agents={mockAgents}
          onAction={onAction}
        />,
      );
    });

    const input = container.querySelector('[data-testid="openui-input"]') as HTMLInputElement;
    expect(input.value).toBe("initial");
    const text = container.querySelector('[data-testid="openui-text"]');
    expect(text?.textContent).toBe("initial");

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, "updated value");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });

    expect(input.value).toBe("updated value");
    expect(text?.textContent).toBe("updated value");
  });

  it("triggers custom actions on Button and Domain cards", async () => {
    const program = `
root = Stack([
  Button("Run All", @RunRoutine("wf-1")),
  RoutineCard("wf-1", "Daily Inspection", "active", "Daily at 08:00", "Yesterday", @OpenRoutine("wf-1"))
])
`;
    const onAction = mock(() => {});

    await act(async () => {
      root.render(
        <DashboardProgram
          program={program}
          state={mockState}
          routines={mockRoutines}
          agents={mockAgents}
          onAction={onAction}
        />,
      );
    });

    const button = container.querySelector('[data-testid="openui-button"]') as HTMLButtonElement;
    await act(async () => {
      button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });

    expect(onAction).toHaveBeenCalled();

    const routineCard = container.querySelector(
      '[data-testid="openui-routine-card"]',
    ) as HTMLDivElement;
    await act(async () => {
      routineCard
        .querySelector("button")!
        .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });

    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("renders demo program with tabs, filters, resets, and routine actions", async () => {
    const { dashboardDemoProgram } = await import("../../src/lib/dashboard-demo");
    const demo = dashboardDemoProgram(mockState, mockRoutines, mockAgents);
    const onAction = mock(() => {});

    await act(async () => {
      root.render(
        <DashboardProgram
          program={demo}
          state={mockState}
          routines={mockRoutines}
          agents={mockAgents}
          onAction={onAction}
        />,
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    const getTabButtons = () => Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(getTabButtons().length).toBeGreaterThanOrEqual(4);

    // Initial active tab: overview
    const metrics = container.querySelectorAll('[data-testid="openui-metric"]');
    expect(metrics.length).toBeGreaterThanOrEqual(2);

    // Switch to machines tab
    const machinesTab = getTabButtons().find((b) => b.textContent?.includes("Máquinas"));
    expect(machinesTab).toBeDefined();
    await act(async () => {
      machinesTab!.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true }));
      machinesTab!.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
      machinesTab!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });

    // Table initially shows machines
    let machinesTable = container.querySelector('.agent-usage-table');
    expect(machinesTable?.textContent).toContain("CNC Milling Machine");

    // Type non-matching filter in machines tab
    const input = container.querySelector('[data-testid="openui-input"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, "NonExistentMachine");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(input.value).toBe("NonExistentMachine");

    // Excludes original machine
    machinesTable = container.querySelector('.agent-usage-table');
    expect(machinesTable?.textContent).not.toContain("CNC Milling Machine");

    // Click Reset button to clear filter
    const resetButton = Array.from(
      container.querySelectorAll('[data-testid="openui-button"]'),
    ).find((b) => b.textContent?.includes("Limpar")) as HTMLButtonElement;
    expect(resetButton).toBeDefined();
    await act(async () => {
      resetButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    expect(input.value).toBe("");
    machinesTable = container.querySelector('.agent-usage-table');
    expect(machinesTable?.textContent).toContain("CNC Milling Machine");

    // Switch to actions tab
    const actionsTab = getTabButtons().find((b) => b.textContent?.includes("Ações"));
    expect(actionsTab).toBeDefined();
    await act(async () => {
      actionsTab!.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true }));
      actionsTab!.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
      actionsTab!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });

    let actionsTable = container.querySelector('.agent-usage-table');
    expect(actionsTable?.textContent).toContain("Check machine filters");
    expect(actionsTable?.textContent).toContain("Inspect bearings");

    // Filter actions by status
    const select = container.querySelector('[data-testid="openui-select"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    await act(async () => {
      select.value = "open";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });

    actionsTable = container.querySelector('.agent-usage-table');
    expect(actionsTable?.textContent).toContain("Check machine filters");
    expect(actionsTable?.textContent).not.toContain("Inspect bearings");

    // Switch to routines tab and trigger OpenRoutine
    const routinesTab = getTabButtons().find((b) => b.textContent?.includes("Rotinas"));
    expect(routinesTab).toBeDefined();
    await act(async () => {
      routinesTab!.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true }));
      routinesTab!.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
      routinesTab!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });

    const routineCard = container.querySelector('[data-testid="openui-routine-card"]');
    expect(routineCard).not.toBeNull();
    expect(routineCard?.textContent).toContain("Daily Inspection");
    const cardButton = routineCard?.querySelector("button");
    expect(cardButton).not.toBeNull();
    await act(async () => {
      cardButton!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: "OpenRoutine", params: { id: "wf-1" } }));
  });
});
