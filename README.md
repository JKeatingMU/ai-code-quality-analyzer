# ACQA: AI-Code Quality Analyzer

ACQA is a static analyser for React/TypeScript code. It computes the **AI-Code Quality Index (ACQI)**, a structural index designed for code that AI tools generate and maintain, alongside two established complexity measures (cyclomatic and cognitive complexity).

- Metrics version 2.1, package 2.1.1
- Licence: MIT
- Author: John G. Keating, Maynooth University

For a fuller explanation of when and how to use ACQI, see **[docs/USING-ACQI.md](docs/USING-ACQI.md)**.

## Why ACQI

The established maintainability measures (cyclomatic complexity, Halstead measures, the Maintainability Index) were validated against people maintaining procedural code in the 1980s and 1990s. They answer the question "how hard is this code for a person to maintain?". Applied to AI-generated code, they have two known problems:

- **They reward things that are not structure.** The Maintainability Index rewards comments. AI tools write few comments, so much of the gap between human and AI code on MI comes from comments, not from how the code is built.
- **Several largely measure size.** Halstead volume, for example, grows with the number of tokens, so larger files score worse almost by definition.

ACQI asks a different question: **how easy is this code for a machine, such as a compiler, a type checker or an AI agent, to reason about and change safely?** It measures structural properties that support that: explicit types, functions without side effects, small units, and consistent, predictable structure.

**ACQI complements the established measures; it does not replace them.** Use it as one lens among several, together with tests (does the code work?) and reading (what does it actually do?). No static measure, ACQI included, can tell working code from broken code.

## What ACQI measures

ACQI = 0.25 T + 0.30 P + 0.20 D + 0.15 C + 0.10 S. Each part is between 0 and 1, and higher is better.

| Part | Name | What it measures | How it is computed |
|---|---|---|---|
| T | Type explicitness | How much of the code states its types | Typed declaration slots ÷ all slots, from the syntax tree (parameters, return types of block-bodied functions, plain variables, interface properties) |
| P | Pure function ratio | How much of the code can be changed locally without hidden effects | Share of functions whose own body has no side effect (the rule is defined by 26 unit tests in `test/purity.test.js`) |
| D | Decomposability | Whether code is divided into units of manageable size | Each top-level function scored by risk band: up to 58 lines of code 1, up to 79 2/3, up to 118 1/3, above 0; LOC-weighted mean |
| C | Pattern consistency | Consistency of naming style | Share of identifiers in the dominant case style (a regular-expression heuristic) |
| S | Structural predictability | Whether a file follows a conventional React module layout | Six presence checks (imports, export, hooks, JSX, type annotations, ordering), as a share |

The decomposability thresholds are not chosen by hand. They are derived from a benchmark of 181 human-written React/TypeScript projects from before June 2022 (16,316 functions), using the method of Alves, Ypma and Visser (2010). For comparison, the same method gives 30 / 44 / 74 lines for Java.

When a part does not apply to a file (for example, a file with no functions has no P or D), it is left out and ACQI is the weighted mean of the remaining parts.

ACQA also reports cyclomatic complexity (a keyword count over the whole file) and cognitive complexity (following Campbell, 2018). It does not compute Halstead measures or the Maintainability Index.

## Quick start

Requires Node.js 18 or later.

```bash
git clone https://github.com/JKeatingMU/ai-code-quality-analyzer.git
cd ai-code-quality-analyzer
npm install

# Analyse a project
node src/cli.js analyze path/to/project --type human --output results/project.json \
  --exclude "node_modules,dist,build,.git,coverage,public,.next"

# Combine many results into one CSV
node src/cli.js aggregate "results/*.json" --output results/summary.csv

# Run the purity-rule tests
npm test
```

`--type` records whether the code is `human`, `ai` or `unknown`; it does not change the measurement.

## Output

The JSON output has four parts:

- `metadata`: the directory, code type, ACQA and metrics versions, file and line counts
- `aggregateStats`: mean, median, minimum, maximum and standard deviation of each measure across files
- `files`: every measure for every file
- `prompts`: the prompts used to generate the code, if supplied with `--prompts`

The repository-level ACQI is the mean of the file-level scores.

## Versions and reproducibility

| Metrics version | Changes | How to run |
|---|---|---|
| 2.1 (current) | Effect-based purity rule; decomposability thresholds derived from a benchmark | default |
| 2.0 | Fixed JSX parsing and decomposability; type explicitness from the syntax tree | not kept separately |
| 1 | Original research release. Contains a parsing defect: files with JSX failed to parse, so P and D returned 0.5 for most React files | `--legacy` |

Version 1 is kept, unchanged, in `legacy/` only so that results published before September 2026 can be reproduced exactly. **Do not use it for new work.** See [CHANGELOG.md](CHANGELOG.md) for details.

## Known limitations

- **The weights are expert judgement.** They express a design priority (side-effect-free code first, then types, unit size, conventions and layout). Work to derive them from maintenance outcomes is under way. Findings reported with ACQI should be checked for sensitivity to the weights.
- **C and S are heuristics.** They use regular expressions, not the syntax tree, and are the least developed parts of the index.
- **The purity rule is a definition, not a fact.** It is tested against 26 cases; validation against independent human judgement is planned.
- **Decomposability depends on its benchmark.** The current benchmark is drawn from shop and e-commerce style React projects.
- **React/TypeScript only.** The framework (a weighted index of structural sub-measures) could be adapted to other languages; the sub-measures would change.
- **Static analysis only.** ACQI does not run the code and cannot detect defects, security problems or behaviour beyond the specification.

## Citing ACQA

If you use ACQA in research, please cite it using the information in [CITATION.cff](CITATION.cff) (GitHub shows a "Cite this repository" button), and give the metrics version you used.

## Licence

MIT. See [LICENSE](LICENSE).
