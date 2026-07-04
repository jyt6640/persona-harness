# Rail-Entry Prompt Regression Gate

Status: reusable operator-run gate for rail, `AGENTS.md`, and gate-output wording changes.

This gate repackages the Stage 9 rail-entry measurement shape as a small prompt
regression/non-inferiority check. It is for wording safety only. It does not
measure product efficacy, token saving, app quality, reliability, closure
guarantee, or any default-change decision.

## Stage 9 Reference

Stage 9 archive:

`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage9-banner-only-rail-entry-ab-10-20260703T053234Z`

Accepted Stage 9 result:

- OFF rail entry: 10/10.
- ON rail entry: 10/10.
- Paired delta: 0 percentage points.
- H1 judgment: `not-supported-for-this-fixture`.

Interpretation caution: Stage 9 showed that runtime-injection banner-only H1
was not supported for that fixture. This regression gate must not be cited as
runtime-injection benefit evidence.

## When To Run

Run this gate before accepting wording changes that may affect early rail entry,
including:

- `AGENTS.md` rail instructions.
- rail prompt blocks.
- `workflow finish` / `workflow check` blocker-output wording.
- future Stage 20 finish/check compression wording.

Do not run this gate in normal unit tests. Real OpenCode sessions are
operator-triggered and archived.

## Command

Create an archive and preregister the gate:

```sh
ARCHIVE="/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rail-entry-prompt-regression-<slug>-<timestamp>"
node scripts/rail-entry-prompt-regression-gate.mjs init --archive "$ARCHIVE" --scenario "<scenario-id>"
```

After real paired sessions have been run and `summary.json` has been written:

```sh
node scripts/rail-entry-prompt-regression-gate.mjs check --archive "$ARCHIVE"
```

## Gate Contract

- Minimum sample: n >= 5 paired rows.
- Conditions: current/control wording vs candidate wording.
- Pair matching: README sha256, TASK sha256, and start commit must match inside
  each pair.
- Invalid runs must be 0 for PASS. Otherwise the gate is FAIL/PARTIAL and the
  invalid runs must be rerun or explicitly accounted for.
- Primary outcome: rail entry within the first 10 tool calls.
- PASS criterion: candidate rail-entry rate is non-inferior to current/control;
  the default threshold is candidate-current >= 0 percentage points.

## Output Shape

`init` writes:

- `measurement-plan.json`
- `KILL_CRITERIA.md`
- `summary-template.json`

The operator or measurement runner writes:

- `summary.json`
- `RESULT.md`
- raw OpenCode logs when real sessions are executed

`check` validates the plan/summary shape, pair matching fields, invalid-run
policy, and non-inferiority threshold.

## Boundaries

This is a wording regression gate only. It makes no token/provider-token saving,
product-efficacy, navigation-benefit, app-quality, full-TDD/test-sufficiency,
broad reliability, closure guarantee, autonomous completion, generated-app
certification, default-change, or automatic completion/downgrade/removal claim.
