# Using ACQI: what it is for, and how to read it

This guide explains when ACQI is useful, how it relates to the established measures, and how to read and report its scores. For installation and commands, see the [README](../README.md).

## 1. One question per lens

Every quality measure answers one narrow question. Problems start when a measure is read as answering a question it does not ask.

| Lens | The question it answers | What it cannot see |
|---|---|---|
| Tests | Does the code do what the specification says? | Anything the tests do not check, including behaviour beyond the specification |
| Close reading | What does the code actually do, and why is it written this way? | Nothing in principle, but it is slow and depends on the reader |
| Cyclomatic complexity | How many independent paths run through a function? | Types, naming, size of straight-line code |
| Cognitive complexity | How hard is the control flow for a person to follow? | Everything except control flow |
| Halstead measures | How much information (operators and operands) does the code contain? | Structure; it grows with size almost by definition |
| Maintainability Index | A calibrated blend of volume, complexity, size and comments, fitted to human maintenance of 1980s/90s code | Types; it rewards comments whatever they say |
| **ACQI** | **How easy is the code for a machine (compiler, type checker, AI agent) to reason about and change safely?** | **Whether the code works; what it does beyond its structure** |

ACQI adds a question the others do not ask. It does not answer theirs.

## 2. A small example: the lenses disagree

Take one React component in two versions with identical behaviour. Version B adds type annotations and interfaces; nothing else changes.

| Lens | Version A (no types) | Version B (typed) | What the lens says |
|---|---|---|---|
| Cyclomatic complexity (per function) | 1 | 1 | no change: it cannot see types |
| Cognitive complexity (per function) | 0 | 0 | no change |
| Halstead volume | 493.5 | 931.2 | "more complex" |
| Maintainability Index (raw) | 96.97 | 83.74 | "less maintainable" |
| Type explicitness (T, part of ACQI) | 0.00 | 0.85 | "better" |

None of the lenses is wrong. Halstead counts more tokens, the Maintainability Index sees more lines, and ACQI sees explicit contracts that a type checker or an agent can use. Which change is better depends on who maintains the code, and for what.

## 3. When to use ACQI

- **Comparing versions of the same code**, for example before and after a change, or the output of two prompts or two tools for the same specification.
- **Comparing groups of projects** built with different tools or by different kinds of authors, on the same framework.
- **Screening a large codebase**: the per-file parts point to files with untyped interfaces, impure functions or very long units, so reviewers know where to look first.
- **Teaching**: each part is simple enough to compute by hand for a small file, which makes it a good vehicle for learning how any metric is built.

## 4. When not to use it

- **To decide whether code is correct.** Run tests. In a controlled comparison of 40 AI-generated versions of one component, a version that failed four of ten specification tests scored higher on ACQI than versions that passed all ten.
- **As an absolute pass mark.** There is no validated "good" ACQI value. Compare like with like.
- **Across frameworks or languages without care.** Framework conventions can shift scores more than authorship does.
- **On a single AI generation.** The same prompt can produce different code on each run. Generate several times (five is a reasonable minimum) and report the spread.

## 5. Reading a score

- **Look at the parts, not only the total.** Two files with the same ACQI can differ completely: one well typed with long functions, another untyped with small pure functions. The parts tell you what to change.
- **Check which parts were applicable.** A file with no functions has no P or D; its ACQI comes from the other parts. The JSON output records `null` for parts that do not apply.
- **Know the benchmark behind D.** A unit above 58 lines of code is "longer than where 70% of the code sits" in the benchmark of human-written React projects. It is a flag to look, not a verdict: React components carry their markup, so some long units are reasonable.
- **Treat C and S with caution.** They are pattern heuristics and discriminate least.

## 6. Why use it in addition to the established measures

Early results from the author's analysis of 474 React repositories, human-written and AI-generated (not yet peer reviewed), point to three reasons:

- **Comment dependence.** Removing the comment term from the Maintainability Index reorders the groups in the Vite cohort, putting Claude Code first and human-written code second, so much of MI's apparent gap between human and AI code is about comments.
- **Size dependence.** Across repositories, Halstead volume correlates strongly with average file size (r = 0.89); ACQI is only weakly related to it (r = −0.37).
- **A different maintainer.** AI-generated code is increasingly maintained by AI agents. Explicit types, side-effect-free functions and small units are properties an automated maintainer can use directly. Whether they predict easier maintenance is being tested, not assumed (see section 8).

The same analysis also shows that some findings depend on how the parts are defined. A finding that survives changes of definition and weighting deserves more confidence than one that does not.

## 7. Good practice when reporting ACQI

1. **State the ACQA and metrics versions** (both are in the JSON metadata).
2. **Report the parts** alongside the total.
3. **Test the weights.** Check whether your conclusion holds under other reasonable weightings, including equal weights.
4. **Repeat AI generations** and report the spread, not one run.
5. **Pair it with tests and reading.** A structural score says nothing about behaviour.
6. **Do not use version 1** (`--legacy`) except to reproduce earlier published results.

## 8. What is still open

- **The weights.** They express a design priority, not an empirical fit. The next step is to derive them from maintenance outcomes: how successfully and cheaply real maintenance tasks can be carried out on code with different profiles.
- **C and S.** Both are due to be rebuilt on the syntax tree, or replaced.
- **The purity rule** is to be checked against independent human judgement.
- **Beyond code.** Static measures predict maintenance effort; they do not measure it. Where you can, check their predictions against what actually happens when the code is maintained.
