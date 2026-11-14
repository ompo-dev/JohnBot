# Styles baseline fixture

`styles-baseline.css.gz` is a deterministic compressed baseline of the core stylesheet sections.
It contains 73 stylesheet sections and 26,805 declarations/import occurrences, serving as an immutable reference.

The self-contained style check (`scripts/check-original-styles.mjs` / `bun run styles:check`) uses this committed snapshot.
It verifies normalized selector/ancestor/property/value/importance multisets and occurrence counts, rejecting missing declarations, unknown sections, and section ordering drifts while allowing additive styling.

`node .github/scripts/test-style-fixture.mjs` removes a real declaration in a temporary tree
and proves that the comparison fails. Do not regenerate this fixture from modified CSS to
make a regression pass; review and document any intentional baseline change separately.

Fixture SHA-256: `38abf88839ba2ce66c11b1019b0062722b49716df5cc21e6f16c8e8d7d230541`.

