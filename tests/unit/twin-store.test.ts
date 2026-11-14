import assert from "node:assert/strict";
import { twinField, twinStore } from "../../src/stores/twin-store";
import { nodes, selectedNode, setSelectedNodeId } from "../../src/john/john-store";
let notifications = 0;
const stop = twinStore.subscribe(() => notifications++);
const [, setData] = twinField("data");
setData({
  nodes: [{ id: "person", name: "Pessoa atualizada", kind: "person", detail: "" }],
  edges: [],
  notebooks: [],
});
setSelectedNodeId("person");
assert.equal(nodes()[0]?.name, "Pessoa atualizada");
assert.equal(selectedNode()?.name, "Pessoa atualizada");
const [mode, setMode] = twinField("viewMode");
setMode("cargos");
assert.equal(mode(), "cargos");
assert.equal(notifications, 3, "Loads, selection and mode switches must all notify mounted views");
stop();
console.log("PASS Twin: shared Zustand data, selection and mode changes notify React subscribers");
