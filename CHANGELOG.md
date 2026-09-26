# Changelog

## 2.0.0 (2026-09-26): metrics version 2

Fixes that change measured values. Run `acqa analyze --legacy` to use metrics version 1 (`src/analyzer-v1.js`, unchanged) and reproduce results published before September 2026.

- **JSX parsing.** Version 1 passed `ecmaFeatures: { jsx: true }`, which typescript-estree ignores, so every file containing JSX failed to parse. Pure Function Ratio and Decomposability then returned 0.5, and Cognitive Complexity fell back to the McCabe keyword count. Files are now parsed in JSX mode by extension (`.ts`, `.mts` and `.cts` without JSX).
- **Decomposability.** Version 1 read `node.range` without requesting ranges, so it returned 0.5 for any file containing a function. Ranges are now requested.
- **Type Explicitness.** Now computed from the syntax tree as typed declaration slots divided by all slots: function parameters, return types of block-bodied functions, variables that are neither destructured nor initialised with a function, and interface properties. A file with no slots returns `null` (not applicable) instead of 1.0. The version 1 regular expression remains available as `calculateTypeExplicitnessRegex`.
- **ACQI.** The weighted mean of the non-null sub-metrics, so a file without declaration slots is scored on the other four.
- **Output.** JSON metadata records `acqaVersion` and `metricsVersion`. CSV aggregation no longer prints a mean of 0 as blank.

## 1.0.0

Initial research release.
