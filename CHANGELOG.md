# Changelog

## 2.1.1 (2026-10-01): public release

No change to any measured value (metrics version 2.1).

- README, usage guide (`docs/USING-ACQI.md`), MIT licence file and citation file added.
- Version 1 moved to `legacy/`, kept only to reproduce earlier published results.
- Outdated top-level copies of the version 1 analyser and command line, the old installation guide and setup script removed.
- `package.json` corrected (author, entry point, scripts, repository).

## 2.1.0 (2026-09-27): metrics version 2.1

- **Pure function ratio.** A function is impure only if its own body mutates something it did not declare, calls a known side-effecting API or reads a browser global, calls a state setter, `dispatch` or a callback received as a parameter (its own or an enclosing function's), or calls a mutating method on something it did not declare. React hooks are not effects, and nested functions are judged separately. Version 2 treated any function call as a side effect, which scored almost all React code as impure. The rule is defined by unit tests in `test/purity.test.js` (26 from 2.1.1). Validation against independent human labelling is planned.
- **Decomposability.** Follows Alves, Ypma and Visser (2010), doi:10.1109/ICSM.2010.5609747.
  - A unit is a top-level function or class method, with nested handlers belonging to their unit.
  - Unit size is lines of code (lines with at least one token).
  - The risk thresholds, 58 / 79 / 118 LOC, are the 70th/80th/90th percentiles of the LOC-weighted, repository-normalised unit-size distribution of 181 distinct pre-Copilot React/TypeScript repositories (16,316 units). Tests, generated code, duplicate template copies, non-React projects and 12 outlier systems (removed after review, as AYV require) were excluded.
  - `extractUnits` measures both the benchmark and analysed code.
  - Each unit scores 1, 2/3, 1/3 or 0 by risk band, and the file score is the LOC-weighted mean. This mapping is ACQA's own choice, not part of AYV.
  - Version 2 used a fixed 50-line cut-off on physical lines.
- Both return `null` when a file has no functions, and ACQI is then calculated from the remaining sub-metrics.
- Effect on corpus findings: the leading position of Claude Code-generated projects and the greater homogeneity of AI platform code hold under versions 1, 2 and 2.1; the near-parity between human and AI groups is sensitive to how the sub-metrics are defined.

## 2.0.0 (2026-09-26): metrics version 2

Fixes that change measured values. Run `acqa analyze --legacy` to use metrics version 1 (`legacy/analyzer-v1.js`, unchanged) and reproduce results published before September 2026.

- **JSX parsing.** Version 1 passed `ecmaFeatures: { jsx: true }`, which typescript-estree ignores, so every file containing JSX failed to parse. Pure Function Ratio and Decomposability then returned 0.5, and Cognitive Complexity fell back to the McCabe keyword count. Files are now parsed in JSX mode by extension (`.ts`, `.mts` and `.cts` without JSX).
- **Decomposability.** Version 1 read `node.range` without requesting ranges, so it returned 0.5 for any file containing a function. Ranges are now requested.
- **Type Explicitness.** Now computed from the syntax tree as typed declaration slots divided by all slots: function parameters, return types of block-bodied functions, variables that are neither destructured nor initialised with a function, and interface properties. A file with no slots returns `null` (not applicable) instead of 1.0. The version 1 regular expression remains available as `calculateTypeExplicitnessRegex`.
- **ACQI.** The weighted mean of the non-null sub-metrics, so a file without declaration slots is scored on the other four.
- **Output.** JSON metadata records `acqaVersion` and `metricsVersion`. CSV aggregation no longer prints a mean of 0 as blank.

## 1.0.0

Initial research release.
