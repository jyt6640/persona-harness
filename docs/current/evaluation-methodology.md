# Persona Harness Evaluation Methodology

## Goal

Persona Harness external evaluation should produce honest, reproducible signals about workflow reliability and backend stack steering.
It should not claim generated application quality proof from shallow smoke evidence.

## Current Verification System

Current coverage is split across three surfaces:

| Surface | What it checks | What it does not prove |
| --- | --- | --- |
| Unit and parser tests | intent routing, workflow skill loading, report status parsing, observer heuristics | generated app quality |
| Integration workflow tests | `ph workflow split/next/check/finish`, report lifecycle, prompt-only requirements transitions | real provider behavior under long runs |
| External smoke docs | install path, OpenCode run, Gradle checks, backend-shape review, evidence summary | statistically reliable model comparison |

The current external ON/OFF smoke reports are useful as failure-mode discovery and stack-steering signals, not as quality certification.

## Evidence Meaning

Persona Harness evidence means read/injection/workflow trace.

Evidence can answer questions such as:

- Which target file or role did the harness observe?
- Did workflow rail, read coverage, command discipline, or continuation evidence appear?
- Did `workflow check` or `workflow finish` see enough report artifacts?

Evidence does not prove:

- generated app product quality;
- correctness of business behavior;
- architectural quality beyond the report-only rubric that was actually run;
- that the AI fully understood every file it touched.

When reporting evidence, use language like "trace observed", "read coverage signal", or "stack steering signal".
Do not use language like "quality proven" or "certified".

## ON/OFF Smoke Limitations

Current ON/OFF smoke comparisons are limited by:

- small sample size, often `n=1` per fixture or per mode;
- non-blind review;
- same operator for setup, execution, and interpretation;
- single model or narrow model family;
- provider, model version, timeout, local Gradle/JDK, and machine-state dependence;
- prompt wording and README fixture specificity;
- possible carryover from manual recovery or report formatting corrections.

These runs can show failure modes and directional stack steering.
They should not be presented as statistically rigorous A/B proof.

## Candidate Metrics

Track the following as candidate signals:

| Metric | Meaning | Notes |
| --- | --- | --- |
| Compile rate | generated project compiles or `gradle build` reaches expected result | record exact command and environment |
| Test pass rate | generated tests pass | distinguish generated tests from harness tests |
| Finish PASS rate | `npx ph workflow finish implement` passes | workflow compliance signal, not app quality proof |
| Stack alignment | generated stack matches project profile and README constraints | Gradle/Spring/Java shape signal |
| Backend-shape report | `npx ph review backend-shape` PASS/WARN results | report-only rubric |
| Failure mode count | count and classify failures such as wrong stack, timeout, provider limit, pending tickets, raw-shell final verification | more useful than one global score |

For each run, keep raw command outputs or stable summaries sufficient for another reviewer to replay the judgment.

## External Tester Required Checks

Every external tester report should answer:

- What did the AI actually read?
- Did `npx ph workflow finish implement` PASS?
- Did build and test commands actually pass?
- Were any requirements pending?
- Did timeout, provider limit, token limit, or permission limits affect the run?
- Was backend-shape review run, and what did it report?
- Is the result being interpreted as stack steering/failure-mode signal rather than generated app quality certification?

## Future Rigor Plan

Minimum next-step evaluation design:

1. Use at least three README fixtures.
2. Run ON and OFF at least twice per fixture.
3. Include Mac and Windows runs when practical.
4. Use the same prompt, timeout policy, model/version record, Java version, and Gradle command list.
5. Apply the same backend-shape rubric to every generated project.
6. Add a blind or second reviewer pass before making public comparative claims.
7. Track effect size and confidence intervals only after the sample size is large enough to make them meaningful.

Until that rigor exists, describe results as preliminary signals.

The preregistered v0.4 fixture matrix, baseline conditions, kill-gate, success threshold, and reviewer rubric are recorded in `docs/current/v0.4-evaluation-plan.md`.
The operator runbook skeleton for executing that matrix is recorded in `docs/current/v0.4-evaluation-runbook.md`.

## Reporting Language

Use:

- "ON reduced this failure mode in this run set."
- "ON showed a stack-steering signal toward Gradle/Spring layered shape."
- "Evidence trace was present/missing."
- "Backend-shape report found PASS/WARN items."

Avoid:

- "Persona Harness proves code quality."
- "Evidence proves the model read everything correctly."
- "A/B proves ON is better" without sample size, blind review, and repeated runs.
