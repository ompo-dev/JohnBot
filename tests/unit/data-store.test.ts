import assert from "node:assert/strict";
import {
  beginOptimistic,
  invalidateQueries,
  putQuery,
  readEntry,
  resetDataStore,
} from "../../src/stores/data-store";
const key = "/api/test";
putQuery(key, 0);
const initial = readEntry(key);
assert.ok(initial);
const observed = initial.revision;
const first = beginOptimistic(key, () => 1);
const second = beginOptimistic(key, () => 2);
assert.equal(readEntry(key)?.data, 2);
first.rollback(new Error("old failed"));
assert.equal(readEntry(key)?.data, 2);
second.rollback(new Error("new failed"));
assert.equal(
  readEntry(key)?.data,
  0,
  "all failures restore confirmed base, never a failed optimistic value",
);
const third = beginOptimistic(key, () => 3);
third.commit(30);
putQuery(key, 99, observed);
assert.equal(readEntry(key)?.data, 30, "late GET cannot overwrite a mutation");
const older = beginOptimistic(key, () => 4);
const newer = beginOptimistic(key, () => 5);
newer.commit(50);
older.commit(40);
assert.equal(readEntry(key)?.data, 50);
invalidateQueries();
assert.equal(readEntry(key)?.invalidated, true);
resetDataStore();
assert.equal(readEntry(key), undefined);
console.log(
  "PASS: optimistic layers, overlapping failures, late reads, confirmation ordering, invalidation and reset",
);
