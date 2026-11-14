import assert from "node:assert/strict";

const base = process.env.JOHNBOT_TEST_URL ?? "http://localhost:3000";
const handshake = await fetch(`${base}/api/account/state`);
assert.equal(handshake.status, 200);
const cookie = handshake.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
const requestId = crypto.randomUUID();
const execute = async () => {
  const response = await fetch(`${base}/api/commands/workflows.run-csv`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ payload: { serverId: "local", workflowId: "wf-machine-downtime-csv", requestId } }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.data;
};
const result = await execute();
assert.equal(result.run.status, "done");
assert.deepEqual(result.steps.map((step: { nodeId: string }) => step.nodeId), ["csv-start", "csv-bronze", "csv-silver", "csv-gold", "csv-report"]);
assert.equal((await execute()).run.id, result.run.id, "Repeated request ID must not create another run");
for (const layer of ["bronze", "silver", "gold", "report"]) {
  const response = await fetch(`${base}/api/datasets/machine-downtime?run=${result.run.id}&layer=${layer}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert(response.headers.get("content-disposition")?.includes("attachment"));
  if (layer === "silver") {
    const data = await response.json();
    assert.equal(data.rows.length, 2500);
    assert.equal(data.rows[0].date, "2021-12-31");
    assert.equal(typeof data.rows[0].sensors.hydraulic_pressure_bar, "number");
  } else if (layer === "gold") {
    const data = await response.json();
    assert.equal(data.failures, 1265);
    assert.equal(data.byMachine.length, 3);
    assert.equal(data.byLine.length, 3);
  } else assert((await response.text()).length > 100);
}
const history = await fetch(`${base}/api/workflows?op=runs&serverId=local&workflowId=wf-machine-downtime-csv`, { headers: { Cookie: cookie } }).then((response) => response.json());
assert.equal(history.data.runs.filter((entry: { run: { id: string } }) => entry.run.id === result.run.id).length, 1);
const isolated = await fetch(`${base}/api/datasets/machine-downtime?run=${result.run.id}&layer=gold`);
assert.notEqual(isolated.status, 200, "Another session cannot download these results");
console.log("PASS: actual CSV execution, five stages, durable layers and history, idempotency and session isolation");
