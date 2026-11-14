import assert from "node:assert/strict";
import { DEMO_OPTIONS } from "../../src/preview/demo-seed";
import { routineToGraph, workflowToRoutine } from "../../src/lib/routine-unification";
import { workflowGraphSchema } from "../../src/contracts/workflows-data";
import { isRoutine, workflowGraphProblem } from "../../src/contracts/ipc";

let checked = 0;
for (const routine of Object.values(DEMO_OPTIONS.routines ?? {}).flat()) {
  const graph = routineToGraph(routine, DEMO_OPTIONS.routineFlowLinks);
  assert.equal(workflowGraphSchema.safeParse(graph).success, true, routine.name);
  assert.equal(workflowGraphProblem(graph), null, routine.name);
  const projected = workflowToRoutine({
    summary: {
      id: routine.id,
      title: routine.name,
      steps: graph.nodes.length,
      updatedAt: routine.updatedAt,
      lastRun: null,
    },
    graph,
    revision: 0,
    triggers: [
      {
        nodeId: "routine-trigger",
        type: "schedule",
        nextDueAt: routine.trigger.nextRunAt,
        webhookUrl: null,
      },
    ],
  });
  assert.ok(projected);
  assert.equal(isRoutine(projected), true);
  assert.equal(projected.id, routine.id);
  assert.equal(projected.agentId, routine.agentId);
  assert.deepEqual(projected.trigger.schedule, routine.trigger.schedule);
  assert.equal(projected.instruction, routine.instruction);
  assert.equal(projected.active, routine.active);
  checked++;
}
console.log(
  `PASS unified routines: ${checked} original schedules and agent handoff graphs validated without changing IDs`,
);
