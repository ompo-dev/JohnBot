import assert from "node:assert/strict";
import { optimisticPlans } from "../../src/lib/api/mutations/optimistic-plans";

const current = { snapshot: { revision: 7, messages: [{ id: "message", reaction: "👍", reactions: [
  { emoji: "👍", actor: { kind: "user" } },
  { emoji: "✅", actor: { kind: "agent", agentId: "reviewer" } },
] }] } };
const [add] = optimisticPlans("agents.change-message", { agentId: "test", action: "reaction", messageId: "message", emoji: "🎉" });
const optimistic = add.update(current) as typeof current;
assert.equal(optimistic.snapshot.revision, 8);
assert.deepEqual(optimistic.snapshot.messages[0].reactions.map((reaction) => reaction.emoji), ["✅", "🎉"]);
assert.equal(current.snapshot.messages[0].reaction, "👍");
const [remove] = optimisticPlans("agents.change-message", { agentId: "test", action: "reaction", messageId: "message", emoji: null });
assert.deepEqual((remove.update(optimistic) as typeof current).snapshot.messages[0].reactions.map((reaction) => reaction.emoji), ["✅"]);
console.log("PASS: optimistic reactions replace/remove only the current user's reaction without mutating the confirmed snapshot");
