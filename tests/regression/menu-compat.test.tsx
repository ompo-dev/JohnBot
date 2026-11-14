import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import React, { act } from "react";
import { productFeatures } from "../../src/lib/product-features";

// Exercise the reversible server-management implementation; production defaults are checked separately.
productFeatures.serverManagement = true;
productFeatures.unifiedRoutines = false;

const dom = new JSDOM("<!doctype html><html><body><div id='test'></div></body></html>", {
  url: "http://localhost/", pretendToBeVisual: true,
});
for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "NodeFilter",
  "Event", "MouseEvent", "KeyboardEvent", "CustomEvent", "MutationObserver", "HTMLInputElement",
  "HTMLButtonElement", "HTMLFormElement", "DocumentFragment", "DOMRect", "getComputedStyle", "location", "history"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.scrollTo = () => {};

const { createRoot } = await import("react-dom/client");
const { NuqsAdapter } = await import("nuqs/adapters/react");
const { UrlStateProvider } = await import("../../src/lib/url-state");
const Menu = await import("../../src/lib/kobalte-dropdown-menu-compat");
const Tooltip = await import("../../src/lib/kobalte-tooltip-compat");
const ContextMenu = await import("../../src/lib/kobalte-context-menu-compat");
const Select = await import("../../src/lib/kobalte-select-compat");
const { For, Show, Switch, Match, createSignal, createStore } = await import("../../src/lib/solid-react-compat");
const reactRoot = createRoot(document.getElementById("test")!);
const root = {
  render: (children: React.ReactNode) => reactRoot.render(<NuqsAdapter><UrlStateProvider>{children}</UrlStateProvider></NuqsAdapter>),
  unmount: () => reactRoot.unmount(),
};
const warnings: unknown[][] = [];
const originalError = console.error;
console.error = (...args) => { warnings.push(args); originalError(...args); };

// Exercise the original animation rules: DOM presence alone missed panels animating themselves out.
const popupSelectors = [".ui-action-menu", ".provider-model-popover", ".context-meter-popover", ".ui-motion-tooltip"];
const popupStyles: string[] = [];
postcss.parse(readFileSync(resolve("src/styles/legacy.css"), "utf8")).walkRules((rule) => {
  if (rule.parent?.type === "root" && popupSelectors.some((selector) => rule.selector === selector || rule.selector === `${selector}:not([data-expanded])`)) popupStyles.push(rule.toString());
});
const stylesheet = document.createElement("style");
stylesheet.textContent = popupStyles.join("\n");
document.head.appendChild(stylesheet);
function assertOpenSurface(element: Element | null, message = "Open popup must use its entrance animation") {
  assert(element, message);
  assert(element.hasAttribute("data-expanded"), message);
  assert(!getComputedStyle(element).animation.includes("ui-menu-out"), message);
}

async function userClick(element: Element) {
  const Pointer = dom.window.PointerEvent ?? dom.window.MouseEvent;
  const pointerDown = new Pointer("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" });
  await act(async () => element.dispatchEvent(pointerDown));
  if (!pointerDown.defaultPrevented) {
    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 });
    await act(async () => element.dispatchEvent(mouseDown));
    if (!mouseDown.defaultPrevented) await act(async () => (element as HTMLElement).focus());
  }
  await act(async () => element.dispatchEvent(new Pointer("pointerup", { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" })));
  await act(async () => element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 })));
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
}

function MenuFixture() {
  return <Menu.Root>
    <Tooltip.Root>
      <Tooltip.Trigger as="div"><Menu.Trigger aria-label="More">More</Menu.Trigger></Tooltip.Trigger>
    </Tooltip.Root>
    <Menu.Portal><Menu.Content><Menu.Item>Open page</Menu.Item></Menu.Content></Menu.Portal>
  </Menu.Root>;
}
await act(async () => root.render(<MenuFixture />));
const trigger = document.querySelector('[aria-label="More"]')!;
await act(async () => trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
await act(async () => trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })));
assert.equal(trigger.getAttribute("aria-expanded"), "true", "Tooltip must not close its parent menu");
assert(document.querySelector('[role="menu"]'));
assertOpenSurface(document.querySelector('[role="menu"]'));
await act(async () => document.querySelector('[role="menuitem"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
assert.equal(trigger.getAttribute("aria-expanded"), "false");
await act(async () => root.render(<ContextMenu.Root><ContextMenu.Trigger className="viewport">
  <button>Canvas action</button>
</ContextMenu.Trigger>
  <ContextMenu.Portal><ContextMenu.Content className="ui-action-menu"><ContextMenu.Item>Action</ContextMenu.Item></ContextMenu.Content></ContextMenu.Portal>
</ContextMenu.Root>));
assert.equal(document.querySelectorAll("button button").length, 0);
assert.equal(document.querySelector(".viewport")?.tagName, "SPAN");
await act(async () => document.querySelector(".viewport")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })));
assertOpenSurface(document.querySelector('[role="menu"]'));
await act(async () => root.render(<Tooltip.Root defaultOpen><Tooltip.Trigger>Tooltip</Tooltip.Trigger>
  <Tooltip.Portal><Tooltip.Content className="ui-motion-tooltip">Tip</Tooltip.Content></Tooltip.Portal>
</Tooltip.Root>));
assertOpenSurface(document.querySelector(".ui-motion-tooltip"));
const Generic = await import("../../src/lib/kobalte-compat");
await act(async () => root.render(<Generic.Root defaultOpen><Generic.Content className="ui-dialog-content">
  <Generic.CloseButton>Close dialog</Generic.CloseButton>
</Generic.Content></Generic.Root>));
assertOpenSurface(document.querySelector(".ui-dialog-content"));
await userClick(document.querySelector(".ui-dialog-content button")!);
assert.equal(document.querySelector(".ui-dialog-content"), null);

let attachments = 0;
function SelectFixture({ label }: { label: string }) {
  return <Select.Root value="one" options={["one", "two"]}>
    <Select.Trigger ref={[(element: HTMLElement | null) => { if (element) attachments++; }]}>
      <Select.Value>{() => label}</Select.Value>
    </Select.Trigger>
  </Select.Root>;
}
await act(async () => root.render(<SelectFixture label="First" />));
const selectTrigger = document.querySelector('[role="combobox"]');
await act(async () => root.render(<SelectFixture label="Second" />));
await act(async () => root.render(<SelectFixture label="Third" />));
assert.equal(document.querySelector('[role="combobox"]'), selectTrigger);
assert.equal(attachments, 1, "Ref arrays must not detach and reattach on every render");
function SelectPopupFixture() {
  return <Select.Root defaultValue="one" options={["one", "two"]}>
    <Select.Trigger aria-label="Test select"><Select.Value /></Select.Trigger>
    <Select.Portal><Select.Content><Select.Listbox /></Select.Content></Select.Portal>
  </Select.Root>;
}
await act(async () => root.render(<SelectPopupFixture />));
await userClick(document.querySelector('[aria-label="Test select"]')!);
assertOpenSurface(document.querySelector('[role="listbox"]'), "Select must stay expanded after pointer release and focus");
const secondOption = Array.from(document.querySelectorAll('[role="option"]')).find((option) => option.textContent === "two")!;
await userClick(secondOption);
assert.equal(document.querySelector('[role="listbox"]'), null, "Select must close after choosing an option");
assert.equal(document.querySelector('[aria-label="Test select"]')?.textContent, "two");

function HookContent({ name }: { name: string }) {
  const [value] = createSignal(name);
  return <span>{value()}</span>;
}
function FlowFixture({ items, shown }: { items: string[]; shown: boolean }) {
  return <>
    <For each={items}>{(item) => { const [value] = createSignal(item); return <span>{value()}</span>; }}</For>
    <Show when={shown}>{() => { const [value] = createSignal("visible"); return <span>{value()}</span>; }}</Show>
    <Switch><Match when={shown}>{() => { const [value] = createSignal("first"); return <span>{value()}</span>; }}</Match>
      <Match when={!shown}>{() => <HookContent name="second" />}</Match></Switch>
  </>;
}
await act(async () => root.render(<FlowFixture items={["one", "two"]} shown />));
await act(async () => root.render(<FlowFixture items={["one"]} shown={false} />));
assert.equal(document.getElementById("test")!.textContent, "onesecond");
await act(async () => root.render(<FlowFixture items={["one", "two", "three"]} shown />));
assert.equal(document.getElementById("test")!.textContent, "onetwothreevisiblefirst");
let store: any;
let updateStore: any;
let renders = 0;
function StoreFixture() {
  [store, updateStore] = createStore({ nested: { count: 0 }, untouched: { label: "same" }, items: [1, 2] });
  renders++;
  return <span>{store.nested.count}</span>;
}
await act(async () => root.render(<StoreFixture />));
const previous = store;
await act(async () => updateStore((draft: any) => { draft.nested.count = 1; draft.items.push(3); }));
assert.equal(previous.nested.count, 0, "A nested update must not mutate the previous React state");
assert.deepEqual(previous.items, [1, 2]);
assert.deepEqual(store.items, [1, 2, 3]);
assert.equal(store.untouched, previous.untouched, "Unchanged branches must retain their identity");
const updated = store;
await act(async () => updateStore((draft: any) => { draft.nested.count = 1; }));
assert.equal(store, updated, "A no-op store update must preserve state identity");
const stableRenders = renders;
await act(async () => updateStore((draft: any) => { draft.nested.count = 1; }));
assert.equal(renders, stableRenders, "No-op effects must stop rendering");

const { PageRail } = await import("../../src/features/window/PageRail");
let openedPage = "";
await act(async () => root.render(<PageRail hidden={false} current="agents" pinned={[]} usageRows={[]}
  onPinChange={() => {}} onAgents={() => {}} onWorkflows={() => { openedPage = "workflows"; }}
  onUsage={() => { openedPage = "usage"; }} onSettings={() => {}} help={null} />));
const more = document.querySelector('button[aria-haspopup="menu"]')!;
assert(more, "Actual rail must expose its More trigger");
await act(async () => more.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
await act(async () => more.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })));
assert.equal(more.getAttribute("aria-expanded"), "true", "Actual More menu must remain open");
await act(async () => document.querySelector('[role="menuitem"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
assert.equal(openedPage, "workflows", "Actual menu selection must navigate");
const { ProviderModelPicker } = await import("../../src/components/organisms/ProviderModelPicker");
await act(async () => root.render(<ProviderModelPicker provider="codex" value="test-model"
  modelOptions={[{ provider: "codex", id: "test-model", name: "Test model" }] as any}
  agentStatus={{ providers: [] } as any} onChange={() => {}} />));
const modelTrigger = document.querySelector(".provider-model-trigger")!;
await act(async () => modelTrigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
assert(document.querySelector(".provider-model-popover"), "Actual header model picker must open");
await act(async () => modelTrigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
assert.equal(document.querySelector(".provider-model-popover"), null, "Actual header model picker must close");
await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
const { ThreadMenu } = await import("../../src/features/conversation/threads/ThreadMenu");
let newThreads = 0;
await act(async () => root.render(<ThreadMenu mode="tabs" tabs={[]} threads={[]} archived={[]}
  activeId="main" canStartNew onNew={() => { newThreads++; }} onOpen={() => {}} onRestore={() => {}} />));
const threadsTrigger = document.querySelector(".agent-threads-menu-button")!;
await act(async () => threadsTrigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
await act(async () => threadsTrigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
assert(document.querySelector('[role="menu"]'), "Actual header threads menu must open");
await act(async () => document.querySelector('[role="menuitem"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
assert.equal(newThreads, 1, "Actual header action must execute after closing");

const { ChatMessageRow } = await import("../../src/features/conversation/ChatMessageRow");
const { MessageActions } = await import("../../src/features/conversation/MessageRendering");
let chosenReaction: string | null = null;
function ReactionFixture() {
  const [open, setOpen] = createSignal(false);
  return <MessageActions message={{ id: "reaction-test", author: "agent", body: "Test" } as any}
    pickerOpen={open()} expandedEmoji={false} copied={false} onTogglePicker={() => setOpen(!open())}
    onExpandEmoji={() => {}} onCopy={() => {}} onReact={(emoji) => { chosenReaction = emoji; setOpen(false); }} />;
}
await act(async () => root.render(<ReactionFixture />));
await userClick(document.querySelectorAll('.message-action-button')[1]!);
await userClick(document.querySelector('[role="menuitemradio"]')!);
assert.equal(chosenReaction, "👍", "Selecting a real emoji option must invoke the reaction action");
await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
await act(async () => root.render(<ChatMessageRow
  message={{ id: "test", author: "you", body: "Message stays visible", createdAt: new Date().toISOString() } as any}
  author={{ kind: "you", name: "You" }} agents={[]} menu={() => null}
  onSelectAgent={() => {}} onOpenLink={() => {}} onPreview={() => {}} onAttachmentAction={() => {}} />));
assert(document.body.textContent?.includes("Message stays visible"), "Actual message must render");
const { ServerMenu } = await import("../../src/features/servers/ServerMenu");
let selectedServer = "";
await act(async () => root.render(<ServerMenu view="menu" serverName="Local"
  servers={[{ id: "local", kind: "local", name: "Local", active: true, state: "online", notificationsMutedUntil: null },
    { id: "other", kind: "remote", name: "Other", active: false, state: "online", notificationsMutedUntil: null }] as any}
  onViewChange={() => {}} onSelect={(id) => { selectedServer = id; }} />));
await userClick(document.querySelector(".sidebar-server-name")!);
assertOpenSurface(document.querySelector(".server-menu"));
const otherServer = Array.from(document.querySelectorAll(".server-menu-row")).find((row) => row.textContent?.includes("Other"))!;
assert(otherServer, "Server switcher must render its real submenu row");
await act(async () => otherServer.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
assertOpenSurface(Array.from(document.querySelectorAll('[role="menu"]')).find((menu) => !menu.classList.contains("server-menu"))!);
await userClick(document.querySelector(".sidebar-server-name")!);
await userClick(document.querySelector(".sidebar-server-name")!);
const serverRow = Array.from(document.querySelectorAll(".server-menu-row")).find((row) => row.textContent?.includes("Other"))!;
await act(async () => serverRow.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
assert.equal(selectedServer, "other", "Enter must select the server without opening its submenu");
assert.equal(document.querySelector(".server-menu"), null, "Selecting a server must close the switcher without a null ref crash");
// nuqs throttles history writes: settle the close before loading the next fixture.
await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
assert.equal(new URLSearchParams(window.location.search).get("menu"), null, "Selecting a server must also clear its menu from the URL");
if (process.argv.includes("--url")) {
  const { createMarketplaceNavigation } = await import("../../src/features/marketplace/marketplace-view");
  let navigation: ReturnType<typeof createMarketplaceNavigation>;
  const requests = new Map<string, (value: any) => void>();
  const loadListing = (link: { id: string }) => new Promise<any>((resolve) => requests.set(link.id, resolve));
  function MarketplaceUrlFixture() {
    navigation = createMarketplaceNavigation(loadListing);
    const top = navigation.state.stack.at(-1);
    return <output id="marketplace-url-view">{top?.kind}:{top?.kind === "skill" ? top.listing.slug : ""}</output>;
  }
  async function navigateFixture(search: string) {
    await act(async () => {
      window.history.replaceState({}, "", `/${search}`);
      window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    });
  }
  await navigateFixture("?page=marketplace&mpView=skill&mpItem=slow-skill");
  await act(async () => root.render(<MarketplaceUrlFixture />));
  assert(requests.has("slow-skill"), "Listing URL must resolve its slug through the loader");
  await act(async () => navigation!.show("apps"));
  await act(async () => requests.get("slow-skill")!({ kind: "skill", skill: { slug: "slow-skill", name: "Slow" } }));
  assert.equal(document.querySelector("#marketplace-url-view")!.textContent, "browse:", "A stale answer must not reopen a listing after switching tabs");
  await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
  assert.equal(new URLSearchParams(window.location.search).get("mpView"), null, "Switching tabs during a pending read must clear the old URL view");
  await navigateFixture("?page=marketplace&mpView=skill&mpItem=restored-skill");
  await act(async () => requests.get("restored-skill")!({ kind: "skill", skill: { slug: "restored-skill", name: "Restored" } }));
  assert.equal(document.querySelector("#marketplace-url-view")!.textContent, "skill:restored-skill", "A valid listing response must restore its detail");
  await navigateFixture("?page=marketplace&mpView=app&mpItem=whatsapp");
  const historyLength = window.history.length;
  await act(async () => navigation!.show("apps", { kind: "app", id: "whatsapp" }));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
  assert.equal(window.history.length, historyLength, "Reopening the same detail must not add an identical history entry");
  await navigateFixture("?page=marketplace&mpView=skill&mpItem=bad%2Fslug");
  assert(!requests.has("bad/slug"), "Invalid listing identifiers must not reach the loader");
  await act(async () => root.render(null));
  await navigateFixture("");
  console.log("PASS URL: listing restoration, rejected identifiers and canceled stale responses");
}
if (process.argv.includes("--upstream")) {
  const { createMarketplaceListing } = await import("../../src/features/marketplace/marketplace-listing");
  const requests: any[] = [];
  let changeQuery: any, changeSort: any, changeVerified: any;
  function ListingFixture() {
    const [query, setQuery] = createSignal("");
    const [sort, setSort] = createSignal("installs");
    const [verified, setVerified] = createSignal<boolean | undefined>(undefined);
    changeQuery = setQuery; changeSort = setSort; changeVerified = setVerified;
    const listing = createMarketplaceListing({ query, sort, verified, category: () => null,
      list: async (request) => { requests.push(request); return { items: [], nextCursor: null }; } });
    return <span>{listing.pending() ? "pending" : "loaded"}</span>;
  }
  await act(async () => root.render(<ListingFixture />));
  await act(async () => changeQuery("whatsapp"));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 260)));
  assert.equal(requests.filter((request) => request.query === "whatsapp").length, 1, "Debounced search must survive its own renders");
  await act(async () => changeSort("name"));
  await act(async () => changeVerified(true));
  assert.equal(requests.at(-1).sort, "name");
  assert.equal(requests.at(-1).verified, true);
  const { Switch: Toggle } = await import("../../src/components/atoms/switch");
  const changes: boolean[] = [];
  function ToggleFixture({ disabled = false }: { disabled?: boolean }) {
    const [checked, setChecked] = createSignal(false);
    return <Toggle checked={checked()} disabled={disabled} onChange={(value) => { changes.push(value); setChecked(value); }} />;
  }
  await act(async () => root.render(<ToggleFixture />));
  await userClick(document.querySelector(".ui-switch-control")!);
  assert.equal(document.querySelector<HTMLInputElement>('[role="switch"]')!.checked, true);
  assert.deepEqual(changes, [true]);
  await act(async () => root.render(<ToggleFixture disabled />));
  await userClick(document.querySelector(".ui-switch-control")!);
  assert.deepEqual(changes, [true], "Disabled switches must not change the connection state");
  console.log("PASS upstream: sorting, verification, debounced search and native connection switches");
}
if (process.argv.includes("--app")) {
  for (const name of ["localStorage", "sessionStorage", "location", "HTMLTextAreaElement", "HTMLDivElement", "HTMLVideoElement", "HTMLMediaElement", "SVGElement", "DOMRect", "File", "FileReader"]) {
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as any;
  (globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  const { createMockjohnBot } = await import("../../src/preview/mock-johnbot");
  const { DEMO_OPTIONS } = await import("../../src/preview/demo-seed");
  const { routineToGraph } = await import("../../src/lib/routine-unification");
  const mock = createMockjohnBot(process.argv.includes("--routines") ? { ...DEMO_OPTIONS, workflows: [
    ...(DEMO_OPTIONS.workflows ?? []), ...Object.values(DEMO_OPTIONS.routines ?? {}).flat().map((routine) => ({ id: routine.id, title: routine.name, graph: routineToGraph(routine, DEMO_OPTIONS.routineFlowLinks), updatedAt: routine.updatedAt })),
  ] } : DEMO_OPTIONS);
  if (process.argv.includes("--routines")) {
    const originalCanvas = mock.api.routineFlows.canvas;
    mock.api.routineFlows.canvas = async (agentId, serverId) => ({ ...await originalCanvas(agentId, serverId),
      workflowGraphs: [await mock.api.workflows.get("wf-machine-downtime-csv", serverId)], workflowRuns: {} });
    const { http } = await import("../../src/lib/api/client");
    const { TWIN_NODES, TWIN_EDGES, NOTEBOOKS } = await import("../../src/john/john-data");
    let liveCookie = "";
    http.defaults.adapter = async (config) => {
      if (process.argv.includes("--http")) {
        const response = await fetch(`http://localhost:3000${config.url}`, { headers: liveCookie ? { cookie: liveCookie } : {} });
        liveCookie = response.headers.get("set-cookie")?.split(";")[0] ?? liveCookie;
        return { data: await response.json(), status: response.status, statusText: response.statusText, headers: {}, config };
      }
      const data = config.url?.includes("account/state") ? { status: "signed_out" } : config.url === "/api/twin" ? { nodes: TWIN_NODES, edges: [...TWIN_EDGES, { from: "p-carlos", to: "p-marina", label: "reporta" }], notebooks: NOTEBOOKS, accessExceptions: [] } : config.url?.includes("agents?") ? [] : config.url?.includes("workflows?") ? await mock.api.workflows.list() : {
        mode: "simulation", revision: 0, viewerId: "p-marina", people: [{ id: "p-marina", name: "Marina Costa", sectorIds: [], roleIds: [], reportsTo: [], goals: ["Decisões operacionais"] }],
        sectors: [], roles: [], agentIds: ["chief"], rules: [], dashboards: [{ id: "dashboard:p-marina", personId: "p-marina", title: "Meu painel", objective: "Rotinas", origin: "template", updatedAt: "2026-11-14T00:00:00Z", widgets: [{ id: "routines", source: "routines", title: "Rotinas recentes", kind: "table", width: "full" }] }], notebooks: [], deliveries: [], actions: [], audit: [], connectors: [], dataset: { source: "demo", sha256: "", records: 0, rejected: 0, duplicates: 0, failures: 0, machines: [] },
      };
      return { data: { ok: true, data }, status: 200, statusText: "OK", headers: {}, config };
    };
  }
  (window as any).johnbot = mock.api;
  for (const [name, method] of Object.entries(mock.api.agent)) {
    if (typeof method !== "function") continue;
    let calls = 0;
    (mock.api.agent as any)[name] = (...args: any[]) => {
      if (!name.startsWith("on") && ++calls > 300) { originalError(new Error(`Repeated agent call: ${name}`).stack); process.exit(1); }
      return method(...args);
    };
  }
  const { App } = await import("../../src/App");
  const { installPointerFocusGuard } = await import("../../src/components/pointer-focus");
  const stopPointerFocusGuard = installPointerFocusGuard();
  console.log("Mounting application in simulated DOM");
  console.error = (...args) => {
    warnings.push(args);
    originalError(...args);
    if (String(args[0]).includes("Maximum update depth")) { originalError(new Error("Application update loop").stack); process.exit(1); }
  };
  await act(async () => root.render(<React.StrictMode><App /></React.StrictMode>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
  assert(document.querySelector(".conversation-header"), "Application must load a conversation");
  async function click(selector: string | Element) {
    console.log("Click:", typeof selector === "string" ? selector : selector.textContent);
    const button = typeof selector === "string" ? document.querySelector(selector) : selector;
    assert(button, `Missing control: ${selector}`);
    await userClick(button);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
  }
  async function waitFor(check: () => boolean, message: string) {
    const deadline = Date.now() + 5000;
    while (!check() && Date.now() < deadline) await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
    assert(check(), message);
  }
  await click(".conversation-header .provider-model-trigger");
  assertOpenSurface(document.querySelector(".provider-model-popover"));
  assert(document.querySelector('.provider-model-popover')?.closest('[data-radix-popper-content-wrapper]'), "Model popup must have a viewport positioner, not be appended in document flow");
  await click(".provider-model-rail-button");
  assertOpenSurface(document.querySelector(".provider-model-popover"), "Clicking a provider inside the model popup must keep it open");
  await userClick(document.body);
  assert.equal(document.querySelector(".provider-model-popover"), null, "Outside pointer must still dismiss the model popup");
  await click(".conversation-header .provider-model-trigger");
  await click(".conversation-header .provider-model-trigger");
  for (let attempt = 0; attempt < 3; attempt++) {
    await click(".sidebar-server-name");
    assertOpenSurface(document.querySelector(".server-menu"), "Server menu must remain visible on every opening");
    await act(async () => document.querySelector(".server-menu")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 70)));
    assert.equal(document.querySelector(".server-menu"), null);
  }
  await click(".conversation-header .side-panel-toggle");
  assert(document.querySelector('.side-panel-toggle[aria-expanded="true"]'));
  await click(".conversation-header .side-panel-toggle");
  await click(".conversation-title");
  await waitFor(() => document.body.textContent?.includes("Settings") ?? false, "Agent settings must show content");
  await click('.agent-settings-avatar');
  assertOpenSurface(document.querySelector('.avatar-editor'), "Avatar editor must stay open after a complete pointer click");
  assert(document.querySelector('.avatar-editor')?.closest('[data-radix-popper-content-wrapper]'), "Avatar editor must have a viewport positioner");
  const avatarChoices = document.querySelectorAll('.avatar-face-choice');
  assert(avatarChoices.length > 1, "Avatar choices must render");
  await click(avatarChoices[1]);
  assertOpenSurface(document.querySelector('.avatar-editor'), "Saving an avatar must not reset the open picker");
  let filePickerRequests = 0;
  const avatarInput = document.querySelector<HTMLInputElement>('.avatar-editor input[type="file"]')!;
  avatarInput.click = () => { filePickerRequests++; };
  await click('.avatar-image-upload');
  assert.equal(filePickerRequests, 1, "File picker ref must survive an avatar save and rerender");
  await userClick(document.body);
  await click('.agent-settings-runtime-rows .provider-model-trigger');
  assertOpenSurface(document.querySelector('.provider-model-popover'), "Settings model picker must open while header picker is also mounted");
  assert.equal(document.querySelectorAll('.provider-model-popover').length, 1);
  await userClick(document.body);
  await click('.window-rail [aria-label="More"]');
  assert(document.querySelector('[role="menu"]'), "More must stay open in full application");
  assertOpenSurface(document.querySelector('[role="menu"]'));
  await click('[role="menuitem"]');
  for (const page of ["Workflows", "Usage", "Settings", "Agents"]) {
    await click(`.window-rail button[aria-label="${page}"]`);
    const selector = ({ Workflows: ".wfn-stage", Usage: ".agent-usage", Settings: '.settings-modal-tab-panel[data-tab="general"]:not([hidden])', Agents: ".conversation-header" })[page]!;
    await waitFor(() => Boolean(document.querySelector(selector)), `${page} must render its actual content`);
    if (page === "Settings") {
      const labels = [...document.querySelectorAll('.settings-modal-nav-item')].map((item) => item.textContent);
      assert(!labels.some((label) => /^(Billing|Updates|Cobrança|Atualizações)$/u.test(label?.trim() ?? "")), "Disabled billing and updates must be absent from settings navigation");
    }
    assert.equal(document.querySelector('.sidebar-update-island'), null, "Disabled update banner must never mount");
    console.log(`PASS page: ${page}`);
  }
  assert(document.querySelector(".conversation-header"), "Returning to Agents must restore conversation");
  await click('.window-rail [aria-label="More"]');
  console.log("Available pages:", Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent));
  await click('.window-rail [aria-label="More"]');
  await click('.window-rail [aria-label="Marketplace"]');
  await waitFor(() => Boolean(document.querySelector(".skills-marketplace-page .skills-marketplace-body")), "Marketplace must render its body");
  if (process.argv.includes("--upstream")) {
    const search = document.querySelector<HTMLInputElement>('.skills-marketplace-page input[type="search"]')!;
    assert(search);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(search, "WhatsApp");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() => Boolean(document.querySelector('.marketplace-app-row-hit[aria-label*="WhatsApp"]')), "Latest catalog must expose WhatsApp");
    await click('.marketplace-app-row-hit[aria-label*="WhatsApp"]');
    const connect = Array.from(document.querySelectorAll(".skills-marketplace-page button")).find((button) => button.textContent === "Link WhatsApp");
    assert(connect, "WhatsApp must offer its real link wizard");
    await click(connect);
    await waitFor(() => Boolean(document.querySelector(".integration-wizard-form")), "WhatsApp wizard must open");
    await click('.integration-wizard-form button[type="submit"]');
    await waitFor(() => Boolean(document.querySelector('.whatsapp-link-qr img[src^="data:image/svg+xml"]')), "WhatsApp QR must render from the preview bridge");
    await click(".integration-dialog-close");
    assert.equal(document.querySelector(".integration-wizard-form"), null, "Cancel must close the WhatsApp wizard");
    const reconnect = Array.from(document.querySelectorAll(".skills-marketplace-page button")).find((button) => button.textContent === "Link WhatsApp");
    assert(reconnect);
    await click(reconnect);
    await click('.integration-wizard-form input[type="radio"][value="code"]');
    await waitFor(() => Boolean(document.querySelector('.integration-wizard-form input[type="tel"]')), "Pairing-code choice must reveal the phone field");
    const phone = document.querySelector<HTMLInputElement>('.integration-wizard-form input[type="tel"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(phone, "+55 11 99999-0000");
      phone.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click('.integration-wizard-form button[type="submit"]');
    await waitFor(() => Boolean(document.querySelector(".whatsapp-pairing-code output")), "Pairing code must come back from the bridge");
    await click(".integration-dialog-close");
    console.log("PASS upstream: WhatsApp QR, cancellation, number input and pairing code");
    await click('.window-rail [aria-label="Agents"]');
    await click('.window-rail [aria-label="Marketplace"]');
    if (!document.querySelector('.skills-marketplace-page input[type="search"]')) await click('.marketplace-crumb-parent');
    const protonSearch = document.querySelector<HTMLInputElement>('.skills-marketplace-page input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(protonSearch, "Proton Pass");
      protonSearch.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() => Boolean(document.querySelector('.marketplace-app-row-hit[aria-label*="Proton Pass"]')), "Latest catalog must expose Proton Pass");
    await click('.marketplace-app-row-hit[aria-label*="Proton Pass"]');
    await click('.proton-pass-connector button[aria-haspopup="menu"]');
    const keyAction = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.toLowerCase().includes("key"));
    assert(keyAction, "Proton Pass must offer access-key connection");
    await click(keyAction);
    const keyInput = document.querySelector<HTMLInputElement>('.vault-secret-form input[type="password"]');
    assert(keyInput, "Access-key form must open");
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(keyInput, "preview-access-key");
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click('.vault-secret-form button[type="submit"]');
    await waitFor(() => Boolean(document.querySelector('.proton-pass-connector [data-status="connected"]')), "Proton Pass must reflect the bridge's connected status");
    const passwordManagers = await mock.api.passwordManagers.list();
    assert(passwordManagers.some((manager) => manager.manager === "protonpass" && manager.state === "connected"));
    const { MARKETPLACE_PLUGINS } = await import("../../src/features/settings/marketplace-plugin-catalog");
    assert(MARKETPLACE_PLUGINS.length >= 200, "Expanded upstream app catalog must be retained");
    console.log("PASS upstream: Proton Pass access-key flow; catalog apps:", MARKETPLACE_PLUGINS.length);
  }
  await click('.window-rail [aria-label="Agents"]');
  for (const [page, selector] of [["John Twin", ".john-twin-pane"], ["Schedule", ".schedule-pane"], ["Routines", ".diagram-view-canvas"]]) {
    await click('.window-rail [aria-label="More"]');
    const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === page);
    assert(item, `More must offer ${page}`);
    await click(item);
    await waitFor(() => Boolean(document.querySelector(selector)), `${page} must render its body`);
    await click('.window-rail [aria-label="Agents"]');
  }
  await click('.conversation-header button[aria-label="New thread"]');
  assert(document.querySelector(".conversation-header"), "Creating a thread must keep the conversation mounted");
    async function navigate(search: string, push = false) {
      await act(async () => {
        window.history[push ? "pushState" : "replaceState"]({}, "", `/${search}`);
        window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }
  if (process.argv.includes("--url")) {
    const query = () => new URLSearchParams(window.location.search);
    const hasWhatsApp = () => Array.from(document.querySelectorAll(".skills-marketplace-page button")).some((button) => button.textContent === "Link WhatsApp");
    await navigate("?agent=research&sidebar=agents&workflow=wf-parada-cnc01&mpView=app&mpItem=whatsapp&panel=settings&panelPanes=settings&panelTab=settings");
    await waitFor(() => !query().has("workflow") && !query().has("mpView") && !query().has("mpItem") && !query().has("sidebar"), "The reported mixed URL must discard inactive page state and defaults");
    const researchThread = mock.readConversationSnapshot("research").threadId;
    await waitFor(() => query().get("thread") === researchThread && !query().has("agent"), "A main conversation must use its host thread ID instead of an agent label");
    await click('.conversation-header .side-panel-toggle');
    await waitFor(() => ["panel", "panelPanes", "panelTab", "panelMax"].every((key) => !query().has(key)), "Closing the side panel must remove its entire query state");
    await click('.window-rail [aria-label="Marketplace"]');
    await waitFor(() => query().get("page") === "marketplace" && !query().has("thread"), "A page change must remove the conversation route");
    await click('.window-rail [aria-label="Workflows"]');
    await waitFor(() => query().has("workflow"), "The workflow page may publish its current workflow");
    await click('.window-rail [aria-label="Settings"]');
    await waitFor(() => !query().has("workflow") && !query().has("mpView") && !query().has("thread"), "Page state must be replaced rather than accumulated");
    await navigate("?page=settings&settingsTab=profile&keep=1");
    await waitFor(() => Boolean(document.querySelector('[data-tab="profile"]:not([hidden])')), "URL must open the requested settings tab");
    assert.equal(query().get("settingsTab"), "profile");
    await navigate("?page=settings&settingsTab=hosted-servers&keep=1");
    await waitFor(() => Boolean(document.querySelector('[data-tab="general"]:not([hidden])')), "Disabled hosted billing must resolve to General settings");
    const notifications = Array.from(document.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent === "Notifications");
    assert(notifications);
    await click(notifications);
    await waitFor(() => query().get("settingsTab") === "notifications", "Settings tab clicks must update the URL");
    assert.equal(query().get("keep"), "1", "Unrelated query keys must survive UI changes");
    await navigate("?page=marketplace&mpView=app&mpItem=whatsapp", true);
    await waitFor(hasWhatsApp, "Direct app URL must restore WhatsApp");
    await act(async () => window.history.back());
    await waitFor(() => Boolean(document.querySelector('[data-tab="notifications"]:not([hidden])')), "Browser Back must restore the prior page and tab");
    await act(async () => window.history.forward());
    await waitFor(hasWhatsApp, "Browser Forward must restore the app detail");
    await navigate("?page=agents&menu=rail-more");
    await waitFor(() => Boolean(document.querySelector('.window-rail [aria-label="More"][aria-expanded="true"]')), "URL must open the sidebar More menu");
    await userClick(document.body);
    await waitFor(() => !query().has("menu"), "Outside dismissal must clear the menu query");
    await navigate("?page=agents&menu=provider-model");
    await waitFor(() => Boolean(document.querySelector(".provider-model-popover")), "Model menu must restore from URL");
    assert.equal(document.querySelectorAll(".provider-model-popover").length, 1, "Only the intended model picker may open");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await waitFor(() => !query().has("menu"), "Escape must clear the menu query");
    await navigate("?page=agents&chatSearch=true&chatQ=hello");
    await waitFor(() => Boolean(document.querySelector('.chat-search-input')), "Chat search must restore from URL");
    assert.equal(document.querySelector<HTMLInputElement>('.chat-search-input')!.value, "hello");
    await navigate("?page=agents&panel=files&panelTab=files&panelPanes=files,settings&panelMax=true");
    await waitFor(() => Boolean(document.querySelector(".side-panel-header")), "Conversation pane must restore from URL");
    await click('.side-panel-tab:not([data-selected="true"]) .side-panel-tab-close');
    await waitFor(() => query().get("panelPanes") === "files" && query().get("panelTab") === "files", "Closing a restored tab must preserve the other restored pane");
    await click('.conversation-header .side-panel-toggle');
    await waitFor(() => !query().has("panel") && !query().has("panelTab") && !query().has("panelPanes") && !query().has("panelMax"), "Closing a restored panel must remove all panel parameters");
    await navigate("?page=agents&globalSearch=true&globalQ=hello&globalTab=messages");
    await waitFor(() => Boolean(document.querySelector('.global-search-input')), "Global search must restore from URL");
    assert.equal(document.querySelector<HTMLInputElement>('.global-search-input')!.value, "hello");
    await act(async () => document.querySelector('.global-search-input')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    await waitFor(() => ["globalSearch", "globalQ", "globalTab"].every((key) => !query().has(key)), "Closing search must clear its visibility, text and tab");
    await navigate("?globalSearch=true&globalQ=hello&globalTab=messages");
    await click('.window-rail [aria-label="Settings"]');
    await waitFor(() => query().get("page") === "settings" && ["globalSearch", "globalQ", "globalTab"].every((key) => !query().has(key)), "Navigating to a page must dismiss the previous global-search surface");
    await navigate("?page=usage&usageRange=7d&usageMetric=tokens");
    await waitFor(() => Boolean(document.querySelector(".agent-usage")), "Usage URL must open its report");
    assert.equal(query().get("usageRange"), "7d");
    await navigate("?page=usage&select=usage-period");
    await waitFor(() => Boolean(document.querySelector('[role="listbox"]')), "Select popup must restore from URL");
    const ninetyDays = Array.from(document.querySelectorAll('[role="option"]')).find((option) => option.textContent?.includes("90"));
    assert(ninetyDays, "Period choices must render");
    await click(ninetyDays);
    await waitFor(() => query().get("usageRange") === "90d" && !query().has("select"), "Selecting a period must update the range and close its URL popup");
    const calendars: { from: string; to: string }[] = [];
    const readCalendar = mock.api.agent.routineCalendar;
    mock.api.agent.routineCalendar = (...args) => { calendars.push(args[0]); return readCalendar(...args); };
    await navigate("?page=schedule&calendarDate=2026-12-15&calendarView=day");
    await waitFor(() => Boolean(document.querySelector(".schedule-pane")), "Calendar URL must open Schedule");
    assert.equal(query().get("calendarDate"), "2026-12-15");
    await waitFor(() => calendars.some((range) => range.from.startsWith("2026-12-14") && range.to.startsWith("2026-12-17")), "Calendar must request the URL-selected date from its data source");
    await navigate("?page=server-settings&settingsServer=local&serverTab=general");
    await waitFor(() => Boolean(document.querySelector('.server-settings-modal-shell')), "Server settings must restore from URL");
    const roster = await mock.api.agent.listAgents();
    const target = roster.find((agent) => agent.id !== query().get("agent")) ?? roster[0];
    assert(target);
    const beforeCanonicalization = window.history.length;
    await navigate(`?page=agents&agent=${encodeURIComponent(target.id)}`);
    await waitFor(() => document.querySelector('.conversation-title')?.textContent?.includes(target.name) === true, "Agent query must select the matching conversation");
    const targetSnapshot = mock.readConversationSnapshot(target.id);
    await waitFor(() => query().get("thread") === targetSnapshot.threadId && !query().has("agent"), "Legacy agent links must normalize to the real conversation ID");
    assert.equal(window.history.length, beforeCanonicalization, "Canonicalization must replace the old URL without creating a dead Back step");
    await navigate(`?thread=${encodeURIComponent(targetSnapshot.threadId!)}`);
    await waitFor(() => document.querySelector('.conversation-title')?.textContent?.includes(target.name) === true, "A host thread ID must resolve its owning agent without an agent-name parameter");
    await act(async () => {
      mock.updateConversationSnapshot(target.id, (snapshot) => { snapshot.messages = []; });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await act(async () => {
      mock.updateConversationSnapshot(target.id, (snapshot) => { snapshot.messages = targetSnapshot.messages; });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    for (const agent of roster.slice(0, 3)) {
      const thread = mock.readConversationSnapshot(agent.id).threadId;
      if (!thread) continue;
      await navigate(`?thread=${encodeURIComponent(thread)}`);
      await waitFor(() => document.querySelector('.conversation-title')?.textContent?.includes(agent.name) === true, "Virtual rows must survive switching conversations with different message counts");
    }
    const sideThreads = await mock.api.agent.listTasks("sales");
    const side = sideThreads.tasks.find((task) => task.state !== "closed");
    assert(side, "The seed must have a real side conversation");
    await navigate(`?agent=sales&thread=${encodeURIComponent(side.id)}`);
    await waitFor(() => query().get("thread") === side.threadId, "Legacy task links must normalize to the backend conversation ID");
    await navigate(`?agent=sales&thread=${encodeURIComponent(side.threadId)}`);
    await waitFor(() => query().get("thread") === side.threadId && document.querySelector('.conversation-title')?.textContent?.includes("Sales") === true, "Side conversations must restore by their backend thread ID");
    const salesThread = mock.readConversationSnapshot("sales").threadId!;
    await click('.conversation-title');
    await waitFor(() => query().get("thread") === salesThread && !query().has("agent"), "The agent name must return to its main conversation");
    await navigate(`?thread=${encodeURIComponent(salesThread)}&panel=files&panelTab=files&panelPanes=files`);
    const sideTab = Array.from(document.querySelectorAll('.agent-threads-tab')).find((tab) => tab.textContent?.includes(side.title));
    assert(sideTab, "An opened side conversation must keep its tab when returning to main");
    await click(sideTab);
    await waitFor(() => query().get("thread") === side.threadId && query().get("agent") === "sales", "A side-tab click must publish its host thread ID and owner");
    assert.equal(query().get("panel"), "files", "Adding the same conversation owner during canonicalization must not close its panel");
    await navigate("?thread=research");
    await waitFor(() => query().get("thread") === researchThread && !query().has("agent"), "An old agent ID in the thread field must resolve to its real owner before canonicalizing");
    const serverRoster = await mock.api.servers.list();
    const remote = serverRoster.find((server) => server.kind === "remote");
    assert(remote, "Race fixture needs the seeded remote server");
    const selectServer = mock.api.servers.select;
    let releaseRemote: (() => void) | undefined;
    mock.api.servers.select = async (id) => {
      if (id === remote.id) await new Promise<void>((resolve) => { releaseRemote = resolve; });
      return selectServer(id);
    };
    await navigate(`?server=${encodeURIComponent(remote.id)}`);
    await waitFor(() => releaseRemote !== undefined, "Remote URL must start its selection request");
    await navigate("?server=local");
    await act(async () => releaseRemote!());
    await waitFor(() => query().get("server") === "local", "A delayed server response must preserve the Back destination");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    assert.equal((await mock.api.servers.list()).find((server) => server.active)?.id, "local", "The host must also return to the final URL-selected server");
    mock.api.servers.select = selectServer;
    await navigate("?page=invalid&settingsTab=invalid&calendarDate=2026-02-30&menu=bad%3Fid");
    await waitFor(() => Boolean(document.querySelector('.window-rail [aria-label="Agents"][aria-current="page"]')), "Invalid page must fall back to Agents");
    assert.equal(document.querySelector('[role="menu"]'), null, "Invalid popup ID must not open a menu");
    await navigate("?page=marketplace&mpView=app&mpItem=whatsapp&keep=reload");
    await act(async () => root.render(null));
    await act(async () => root.render(<React.StrictMode><App /></React.StrictMode>));
    await waitFor(hasWhatsApp, "Full application remount must restore URL state");
    assert.equal(query().get("keep"), "reload");
    assert(!window.location.search.includes("preview-access-key"), "Connection credentials must never enter the URL");
    console.log("PASS URL: deep links, tab clicks, unknown keys, Back/Forward, reload, menus, panels, search, usage, calendar and invalid parameters");
  }
  if (process.argv.includes("--routines")) {
    productFeatures.unifiedRoutines = true;
    assert.equal(document.querySelector('.window-rail-group button')?.getAttribute('aria-label'), "Dashboards", "Dashboards must precede Agents");
    await click('.window-rail [aria-label="More"]');
    const pageMenu = [...document.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent);
    assert.ok(!pageMenu.includes("Notebooks") && !pageMenu.includes("Conexões"), "Internal notebooks and separate connections must not appear in navigation");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true})));
    await navigate("?page=connections");
    await waitFor(() => new URLSearchParams(location.search).get("page") === "marketplace", "Legacy connections must open Marketplace");
    assert.equal(new URLSearchParams(location.search).get("mpInstalled"), "true");
    await navigate("?page=notebooks&notebook=old");
    await waitFor(() => !new URLSearchParams(location.search).has("notebook") && new URLSearchParams(location.search).get("page") !== "notebooks", "Internal notebooks must not expose a public page");
    await navigate("?page=dashboard");
    await waitFor(() => Boolean(document.querySelector('.window-page .agent-usage-body')), "Dashboard must load");
    if (!process.argv.includes("--http")) {
      await waitFor(() => Boolean(Array.from(document.querySelectorAll('.window-page [role="tab"]')).find((tab) => tab.textContent?.includes("Rotinas")) || document.querySelector('.window-page [data-testid="openui-routine-card"] button, .window-page .agent-usage-section-header button, .window-page .agent-usage-table tbody button')), "Dashboard routines section or tab must render");
      const routinesTab = Array.from(document.querySelectorAll('.window-page [role="tab"]')).find((tab) => tab.textContent?.includes("Rotinas"));
      if (routinesTab) await click(routinesTab);
      await waitFor(() => Boolean(document.querySelector('.window-page [data-testid="openui-routine-card"] button, .window-page .agent-usage-section-header button, .window-page .agent-usage-table tbody button')), "Dashboard must show a data-bound routine link");
      const routineTrigger = document.querySelector('.window-page [data-testid="openui-routine-card"] button, .window-page .agent-usage-section-header button, .window-page .agent-usage-table tbody button')!;
      await click(routineTrigger);
      await waitFor(() => Boolean(document.querySelector('.diagram-view-canvas section.wfn-stage')), "A dashboard routine link must uncover the original routine view and its step tools");
      await navigate("?page=dashboard");
    }
    await click('.window-rail [aria-label="More"]');
    await click([...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Routines")!);
    await waitFor(() => document.querySelector('.app-frame')?.getAttribute('data-window-page') === "agents" && Boolean(document.querySelector('.diagram-view-canvas')), "Routines must leave Dashboard and uncover the actual canvas");
    await navigate("?page=dashboard");
    await click('.window-rail [aria-label="More"]');
    await click([...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "John Twin")!);
    await waitFor(() => Boolean(document.querySelector('.window-page .john-twin-pane .agent-row')), "John Twin must show loaded people, not only an empty container");
    assert.match(document.querySelector('.john-twin-pane')?.textContent ?? "", /Marina Costa/);
    await navigate("?page=dashboard");
    await click('.window-rail [aria-label="Agents"]');
    await waitFor(() => document.querySelector('.app-frame')?.getAttribute('data-window-page') === "agents", "Agents must also leave Dashboard");
    await navigate("?page=agents&sidebar=routines&agent=chief");
    await waitFor(() => Boolean(document.querySelector(".diagram-view .diagram-view-chat")), "Routines must keep the original diagram and assistant");
    assert.equal(document.querySelector(".wfn-stage"), null, "Routine overview must not be replaced by the standalone workflow canvas");
    const csvCard = [...document.querySelectorAll(".diagram-node")].find((node) => node.textContent?.includes("Machine Downtime"));
    assert.ok(csvCard, "The manual CSV pipeline must be present in the original routine overview");
    await click(csvCard.querySelector(".diagram-node-select")!);
    const editSteps = [...document.querySelectorAll(".diagram-view-header button")].find((button) => button.textContent?.includes("Editar etapas"));
    assert.ok(editSteps);
    await click(editSteps);
    await waitFor(() => Boolean(document.querySelector(".diagram-view-canvas section.wfn-stage")), "Workflow step tools must be embedded in the original routine view");
    assert.ok(document.querySelector(".diagram-view .diagram-view-chat"), "The routine assistant remains alongside the editing tools");
    assert.equal(document.querySelector("main.wfn-stage"), null, "Embedded tools must not create a second main page");
    const back = [...document.querySelectorAll(".diagram-view-header button")].find((button) => button.textContent?.trim() === "Back");
    assert.ok(back);
    await click(back);
    await waitFor(() => !document.querySelector(".wfn-stage"), "Back must restore the original overview");
    assert.equal(new URLSearchParams(window.location.search).has("workflow"), false);
    await navigate("?page=routines&agent=chief&workflow=routine-briefing");
    await waitFor(() => Boolean(document.querySelector(".diagram-view-canvas section.wfn-stage")), "A routine link must restore its tools inside the routine view");
    assert.equal(new URLSearchParams(window.location.search).get("sidebar"), "routines");
    assert.notEqual(new URLSearchParams(window.location.search).get("page"), "workflows");
    console.log("PASS routines: original overview, sidebar context and assistant preserved; embedded step editor, Back and deep links");
  }
  mock.dispose();
  stopPointerFocusGuard();
}
await act(async () => root.unmount());
console.error = originalError;
assert.equal(warnings.length, 0, warnings.map((args) => args.join(" ")).join("\n"));
dom.window.close();
console.log("PASS: popup entrance CSS; full pointer/focus sequence; select choices; submenu/server keyboard actions; model inside/outside clicks; application navigation in StrictMode; no React warnings.");
