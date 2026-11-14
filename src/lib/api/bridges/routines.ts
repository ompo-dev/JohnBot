import { z } from "zod";
import type { Routine } from "../../../contracts/ipc";
import { toRun } from "../../routine-canvas";
import type { EventRoutine } from "../../../contracts/ipc-events";
import {
  workflowDetailSchema,
  workflowSaveResultSchema,
  workflowSummarySchema,
} from "../../../contracts/workflows-data";
import { unifiedRoutineListSchema } from "../../../contracts/unified-routines";
import { routineToGraph, workflowToRoutine } from "../../routine-unification";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { getData, runCommand } from "../client";

/** Agent settings are a projection of the same PostgreSQL graph edited by the Rotinas canvas. */
export function installUnifiedRoutines(mock: MockjohnBotControls): void {
  const api = mock.api.agent,
    workflows = mock.api.workflows;
  const original = {
    list: api.listRoutines,
    create: api.createRoutine,
    update: api.updateRoutine,
    remove: api.deleteRoutine,
    test: api.testRoutine,
    runs: api.listRoutineRuns,
  };
  const remote = (serverId: string | undefined) => serverId && serverId !== "local";
  const read = (id: string) =>
    getData(
      `/api/workflows?${new URLSearchParams({ op: "get", serverId: "local", workflowId: id })}`,
      workflowDetailSchema,
    );
  const changed = (agentId: string) => mock.emitAgentEvent({ type: "routines-changed", agentId });
  async function owned(agentId: string, routineId: string) {
    const detail = await read(routineId),
      routine = workflowToRoutine(detail);
    if (!routine || routine.agentId !== agentId)
      throw new Error("Rotina não encontrada para este agente.");
    return { detail, routine };
  }
  api.listRoutines = async (agentId, serverId) => {
    if (remote(serverId)) return original.list(agentId, serverId);
    return getData(
      `/api/workflows?${new URLSearchParams({ op: "routines", serverId: "local", agentId })}`,
      unifiedRoutineListSchema,
    );
  };
  api.createRoutine = async (input, serverId) => {
    if (remote(serverId)) return original.create(input, serverId);
    const now = new Date().toISOString(),
      id = crypto.randomUUID();
    const routine: Routine = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
      trigger: {
        id: "routine-trigger",
        routineId: id,
        schedule: input.schedule,
        nextRunAt: now,
        createdAt: now,
        updatedAt: now,
      },
    };
    const result = await runCommand(
      "workflows.create",
      { serverId: "local", payload: { id, title: input.name, graph: routineToGraph(routine) } },
      workflowDetailSchema,
    );
    changed(input.agentId);
    return workflowToRoutine(result.data)!;
  };
  api.updateRoutine = async (input, serverId) => {
    if (remote(serverId)) return original.update(input, serverId);
    const { detail, routine } = await owned(input.agentId, input.routineId);
    const graph = structuredClone(detail.graph);
    const trigger = graph.nodes.find(
      (node) => node.kind === "trigger" && node.fields.routineId === routine.id,
    )!;
    if (input.schedule) trigger.schedule = input.schedule;
    if (input.active !== undefined) trigger.fields.active = input.active;
    trigger.fields.policy = JSON.stringify({
      limitPolicy: input.limitPolicy ?? routine.limitPolicy,
      missedPolicy: input.missedPolicy ?? routine.missedPolicy,
      runIn: input.runIn ?? routine.runIn,
    });
    const owner = graph.nodes.find(
      (node) => node.kind === "agent" && node.fields.agentId === input.agentId,
    );
    if (owner && input.instruction !== undefined) owner.fields.task = input.instruction;
    const saved = await runCommand(
      "workflows.save-graph",
      {
        serverId: "local",
        payload: { workflowId: routine.id, baseRevision: detail.revision, graph },
      },
      workflowSaveResultSchema,
    );
    if (!saved.data.ok) throw new Error("A rotina foi alterada por outro cliente. Recarregue.");
    if (input.name !== undefined && input.name !== routine.name)
      await runCommand(
        "workflows.rename",
        { serverId: "local", payload: { workflowId: routine.id, title: input.name } },
        workflowSummarySchema,
      );
    changed(input.agentId);
    return workflowToRoutine(await read(routine.id))!;
  };
  api.deleteRoutine = async (input, serverId) => {
    if (remote(serverId)) return original.remove(input, serverId);
    await owned(input.agentId, input.routineId);
    await runCommand("workflows.delete", { serverId: "local", payload: input.routineId }, z.null());
    changed(input.agentId);
  };
  api.testRoutine = async (input, serverId) => {
    if (remote(serverId)) return original.test(input, serverId);
    const { routine } = await owned(input.agentId, input.routineId);
    const run = await workflows.startRun({
      workflowId: routine.id,
      requestId: crypto.randomUUID(),
    });
    changed(input.agentId);
    return toRun(run, routine);
  };
  api.listRoutineRuns = async (input, serverId) => {
    if (remote(serverId)) return original.runs(input, serverId);
    const { routine } = await owned(input.agentId, input.routineId);
    const page = await workflows.runs({ workflowId: routine.id, limit: input.limit ?? 20 });
    return page.runs.map((run) => toRun(run, routine));
  };
  const events = mock.api.events;
  const eventOriginal = {
    list: events.listRoutines,
    save: events.saveRoutine,
    remove: events.deleteRoutine,
    test: events.testRoutine,
    runs: events.listRoutineRuns,
  };
  const eventRoutine = (routine: Routine): EventRoutine => ({
    id: routine.id,
    owner: { kind: "agent", id: routine.agentId },
    name: routine.name,
    instruction: routine.instruction,
    active: routine.active,
    timezone: routine.timezone,
    trigger: { kind: "schedule", schedule: routine.trigger.schedule },
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt,
    limitPolicy: routine.limitPolicy,
    missedPolicy: routine.missedPolicy,
    runIn: routine.runIn,
  });
  events.listRoutines = async (input, serverId) => {
    if (remote(serverId) || input.owner.kind !== "agent")
      return eventOriginal.list(input, serverId);
    const [canonical, remaining] = await Promise.all([
      api.listRoutines(input.owner.id),
      eventOriginal.list(input, serverId),
    ]);
    return [
      ...canonical.map(eventRoutine),
      ...remaining.filter((routine) => routine.trigger.kind === "webhook"),
    ];
  };
  events.saveRoutine = async (input, serverId) => {
    if (remote(serverId) || input.owner.kind !== "agent" || input.trigger.kind !== "schedule")
      return eventOriginal.save(input, serverId);
    const common = {
      agentId: input.owner.id,
      name: input.name,
      instruction: input.instruction,
      active: input.active,
      schedule: input.trigger.schedule,
      limitPolicy: input.limitPolicy,
      missedPolicy: input.missedPolicy,
      runIn: input.runIn,
    };
    const routine = input.id
      ? await api.updateRoutine({ ...common, routineId: input.id })
      : await api.createRoutine({ ...common, timezone: input.timezone });
    return { routine: eventRoutine(routine), secret: null };
  };
  events.deleteRoutine = async (input, serverId) => {
    if (remote(serverId) || input.owner.kind !== "agent")
      return eventOriginal.remove(input, serverId);
    const routine = (await api.listRoutines(input.owner.id)).find(
      (routine) => routine.id === input.id,
    );
    if (!routine) return eventOriginal.remove(input, serverId);
    await api.deleteRoutine({ agentId: input.owner.id, routineId: input.id });
  };
  events.testRoutine = async (input, serverId) => {
    if (remote(serverId) || input.owner.kind !== "agent")
      return eventOriginal.test(input, serverId);
    const routine = (await api.listRoutines(input.owner.id)).find(
      (routine) => routine.id === input.id,
    );
    if (!routine) return eventOriginal.test(input, serverId);
    await api.testRoutine({ agentId: input.owner.id, routineId: input.id });
  };
  events.listRoutineRuns = async (input, serverId) => {
    if (remote(serverId) || input.owner.kind !== "agent")
      return eventOriginal.runs(input, serverId);
    const routine = (await api.listRoutines(input.owner.id)).find(
      (routine) => routine.id === input.routineId,
    );
    return routine
      ? api.listRoutineRuns({
          agentId: input.owner.id,
          routineId: input.routineId,
          limit: input.limit,
        })
      : eventOriginal.runs(input, serverId);
  };
}
