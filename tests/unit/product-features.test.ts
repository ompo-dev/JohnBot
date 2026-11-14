import assert from "node:assert/strict";
import { productFeatures } from "../../src/lib/product-features";
assert.equal(productFeatures.billing, false);
assert.equal(productFeatures.payments, false);
assert.equal(productFeatures.updates, false);
assert.equal(productFeatures.serverManagement, false);
assert.equal(productFeatures.unifiedRoutines, true);
console.log("PASS product defaults: billing, payments, updates and server management disabled; unified routines enabled");
