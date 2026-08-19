# Measurement Scorecard Definition
Version: scorecard.1
Status: canonical definition for PH A/B and trial measurements.
Rule: experiments cite this version. Cutoff changes require a version bump
recorded in the History section (append-only). Rendered results are
machine-generated; hand-written interpretation belongs in RESULT.md only.

## Scope and Non-Claims
The scorecard is a secondary observation surface. The primary judgment of any
measurement is its preregistered kill criteria; scorecard results must not
reinforce, soften, or override that judgment. Grades imply no token-saving,
product-efficacy, app-quality, reliability, or closure-guarantee claim.

## Axes
All axes are mechanically judged from existing evidence. No human or LLM
subjective grading is permitted on any axis.

### A. Completion Integrity
Source: closure metrics, TDD evidence.
PASS: `workflow finish implement` exit 0
PARTIAL: blocker count decreased but finish did not pass
FAIL: blocker count unchanged or increased

### B. Rail Compliance
Source: rail-compliance evidence, execution evidence.
PASS: rail entry within first 10 tool calls AND reports filled AND rail-run verification
PARTIAL: rail entry only
FAIL: no rail entry

### C. Code Shape
Source: backend-shape observer report against backend-clean-code-uniformity-rubric.md
(Gradle-only, service storage/id ownership, request DTO, response DTO,
controller delegation, repository boundary).
PASS: 0 rubric violations / PARTIAL: 1-2 / FAIL: 3+
Raw per-item violations are always recorded next to the grade.

### D. Cost (paired ratio only)
Source: token telemetry, run logs. Absolute values are snapshots, never graded.
PASS: ON total tokens <= 1.3x paired OFF / PARTIAL: <= 2.0x / FAIL: > 2.0x
Telemetry unavailable → grade N/A (telemetry unavailable), excluded from aggregation.
Also recorded raw: tool call count, elapsed ms.

### E. Feature Regression (checklist, PASS/FAIL only, both conditions)
Source: session-injection-skips, ralph-loop state, role-boundary evidence.
- subagent/unknown skip evidence consistent (no wrong-session utterance)
- ralph-loop caps respected; runaway retries = 0 (ON condition only)
- role-boundary aggregate <= 1 file per session
- continuation utterance duplicates = 0

## Output Contract
Each experiment archive must contain:
- scorecard.json — machine-generated per-run and aggregate grades + raw values,
  citing scorecardVersion.
- SCORECARD-RESULT.md — rendered from scorecard.json; never hand-edited.
- RESULT.md — links both and carries any human interpretation.
Aggregate presentation is per-pair (condition columns side by side) with grade
and raw value in the same cell, e.g. PASS (0 blockers), PARTIAL (1.7x tokens).

## OpenCode Advisory Observation Result
The governed OpenCode A/B observation uses one portable, host-neutral terminal
record with schema `opencode-advisory-observation.1`. A thin host adapter may
provide only the normalized fields below; the evaluator never executes a model
and never receives or forwards prompt, model output, path, token, credential,
stack, or raw diagnostic fields.

- Binding is exact: candidate and base commit SHAs, package name/version/tar
  SHA/content identity, and configured model `openai/gpt-5.3-codex-spark`.
- Execution is one complete bounded A/B run (`count: 1`) with shared source,
  task, and budget SHA-256 digests; the two cases are exactly
  `static-policy-overlay` and `profile-captured-correction`.
- Metrics are normalized counts/precision plus capsule size, conflict
  overwrites, and rollback outcome. The profile case must carry one verified
  captured correction.
- The fixed `profile-adherence-v1` threshold requires fewer repeated
  corrections, no increase in architecture guesses, no decrease in relevant
  rule precision, capsule size no greater than 1.5x baseline, zero conflict
  overwrites, and a passed rollback outcome.
- A complete bound result is `PASS` or `FAIL`; missing, malformed, mismatched,
  multiple, abnormal, unsupported-model, or secret-bearing input is `UNKNOWN`.
  Every result is marked advisory-only and is never a product, merge, CI, or
  release gate.

## History
- scorecard.1 (2026-07-03): initial definition.
