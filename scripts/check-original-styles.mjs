import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { gunzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const normalize = (text) => text.replace(/\s+/g, " ").trim();
function declarations(tree) {
  const result = new Map();
  tree.walkAtRules("import", (rule) => {
    const key = normalize(`@import ${rule.params}`);
    result.set(key, (result.get(key) ?? 0) + 1);
  });
  tree.walkDecls((declaration) => {
    const parents = [];
    let parent = declaration.parent;
    while (parent && parent.type !== "root") {
      parents.unshift(parent.type === "rule" ? parent.selector : `@${parent.name} ${parent.params}`);
      parent = parent.parent;
    }
    const key = normalize(`${parents.join(" > ")} | ${declaration.prop}: ${declaration.value}${declaration.important ? " !important" : ""}`);
    result.set(key, (result.get(key) ?? 0) + 1);
  });
  return result;
}
const legacy = readFileSync(resolve(root, "src/styles/legacy.css"), "utf8");
const sections = [...legacy.matchAll(/\/\* === from: (.*?) === \*\//g)];
const baseline = gunzipSync(readFileSync(resolve(root, ".github/fixtures/styles-baseline.css.gz"))).toString("utf8");
const baselineSections = [...baseline.matchAll(/\/\* === from: (.*?) === \*\//g)];
assert.equal(baselineSections.length, 73, "Reference fixture must contain all baseline sections");
assert.deepEqual(sections.map((section) => section[1]), baselineSections.map((section) => section[1]), "Stylesheet sections or order changed; review provenance");
const reference = new Map(baselineSections.map((section, index) => [section[1],
  baseline.slice(section.index + section[0].length, baselineSections[index + 1]?.index ?? baseline.length)]));
const missing = [];
let checked = 0;
for (let index = 0; index < sections.length; index++) {
  const name = sections[index][1];
  assert(reference.has(name), `Unknown stylesheet section: ${name}`);
  const expected = declarations(postcss.parse(reference.get(name)));
  assert(expected.size > 0, `Empty reference section: ${name}`);
  const actual = declarations(postcss.parse(legacy.slice(sections[index].index + sections[index][0].length,
    sections[index + 1]?.index ?? legacy.length)));
  for (const [key, count] of expected) {
    checked += count;
    if ((actual.get(key) ?? 0) < count) missing.push(`${name}: ${key}`);
  }
}
assert.equal(missing.length, 0, `Original declarations missing or changed:\n${missing.slice(0, 20).join("\n")}`);
console.log(`Verified ${checked} imported baseline declarations across ${sections.length} stylesheet sections. JohnBot additions retained.`);
