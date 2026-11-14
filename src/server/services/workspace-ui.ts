import { z } from "zod";
import { readDomain, updateDomain } from "../repositories/domain-store";
import { ApiError } from "../errors";
import { requireAgent } from "./workspace";
import { sidebarSchema, sidebarChangeSchema, memoriesSchema, memoryChangeSchema, workflowRunPageSchema } from "../../contracts/workspace-ui";
import { johnDeereSidebar } from "../demo/john-deere";
import { serverEnv } from "../config/env";

const emptySidebar = () => ({
  layout: { revision: 0, sections: [], order: ["people", "unassigned"], agentAssignments: {}, agentOrder: [] },
  pins: { items: [], updatedAt: null },
});
const sidebarSeed = () => sidebarSchema.parse(serverEnv().dataMode === "demo" ? emptySidebar() : johnDeereSidebar());
const isLegacyEmptySidebar = (value: z.infer<typeof sidebarSchema>) =>
  value.layout.revision === 0 && value.layout.sections.length === 0 && value.layout.agentOrder.length === 0;
export async function readSidebar(sessionId: string) {
  const current = await readDomain(sessionId, "sidebar", sidebarSchema, sidebarSeed);
  if (serverEnv().dataMode === "demo" || !isLegacyEmptySidebar(current)) return current;
  return updateDomain(sessionId, "sidebar", sidebarSchema, sidebarSeed, (value) =>
    isLegacyEmptySidebar(value) ? sidebarSeed() : value,
  );
}
export async function changeSidebar(sessionId: string, input: z.infer<typeof sidebarChangeSchema>) {
  return updateDomain(sessionId, "sidebar", sidebarSchema, sidebarSeed, (current) => {
    if (input.kind === "seed-pins" && current.pins.updatedAt !== null) return current;
    if (current.layout.revision !== input.expectedRevision) throw new ApiError(409, "conflict", "Sidebar changed in another client. Reload before saving.");
    const layout = { ...(input.layout ?? current.layout), revision: current.layout.revision + 1 };
    return { layout, pins: input.pins ? { ...input.pins, updatedAt: new Date().toISOString() } : current.pins };
  });
}
export async function readMemories(sessionId: string, agentId: string) {
  await requireAgent(sessionId, agentId);
  return readDomain(sessionId, `memories:${agentId}`, memoriesSchema, () => []);
}
export async function changeMemory(sessionId: string, input: z.infer<typeof memoryChangeSchema>) {
  await requireAgent(sessionId, input.agentId);
  const at = new Date().toISOString();
  return updateDomain(sessionId, `memories:${input.agentId}`, memoriesSchema, () => [], (current) => {
    const existing = current.find((item) => item.id === input.memoryId);
    if (input.action === "clear") return [];
    if (input.action === "delete") return current.filter((item) => item.id !== input.memoryId);
    if (input.action === "create") {
      if (existing) throw new ApiError(409, "conflict", "Memory already exists.");
      return [...current, { id: input.memoryId!, agentId: input.agentId, text: input.text!, origin: "manual" as const, sourceTurnId: null, createdAt: at, updatedAt: at }];
    }
    if (!existing) throw new ApiError(404, "not_found", "Memory not found.");
    return current.map((item) => item.id === input.memoryId ? { ...item, text: input.text!, updatedAt: at } : item);
  });
}
/** No invented execution history: this durable record is populated by a real executor. */
export function readWorkflowRuns(sessionId: string, serverId: string, workflowId: string) {
  return readDomain(sessionId, `workflow-runs:${serverId}:${workflowId}`, workflowRunPageSchema,
    () => ({ runs: [], soloSteps: [], nextBefore: null }));
}
