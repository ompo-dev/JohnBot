import assert from "node:assert/strict";
import { buildFaviconTimeline } from "../../src/lib/favicon";

const timeline = buildFaviconTimeline("loading-face:avatar:0:1", 245);
assert.ok(timeline.length > 0, "the face has frames");
const total = timeline.reduce((sum, frame) => sum + frame.ms, 0);
assert.equal(total, 6000, "the loop lasts six seconds");
for (const frame of timeline) {
  assert.ok(frame.href.startsWith("data:image/svg+xml,"), "a frame is an inline SVG");
  assert.ok(frame.ms > 0);
  const svg = decodeURIComponent(frame.href.slice("data:image/svg+xml,".length));
  assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));
  assert.ok(!svg.includes("NaN"), "a frame never draws undefined coordinates");
}
const distinct = new Set(timeline.map((frame) => frame.href)).size;
assert.ok(distinct >= 4, `the eyes move during the loop: ${distinct} drawings`);
assert.ok(timeline.length < 45, `held frames are merged: ${timeline.length} changes for 60 frames`);
console.log(`PASS: favicon timeline has ${timeline.length} changes over 6s, ${distinct} drawings and no NaN`);
