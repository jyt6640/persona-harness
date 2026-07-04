# v0.6.0-rc.3 Measurement Summary

This summary points to accepted measurement/status records that shape the
`0.6.0-rc.3` release prep. It does not replace append-only status files under
`docs/current/`.

## Stage 15 Ralph-loop Correction

The n=15 ralph-loop tool-output trigger status remains corrected:

- `blockerDelta -3.00` is blocker resolution/exposure movement for initially
  named blockers, not total blocker reduction.
- Visible blockers increased `3 -> 6` after hierarchical closure gates exposed
  deeper gates.
- Finish PASS stayed OFF `0/15` and ON `0/15`.
- All ON sessions had `attempts=1`; `cooldownMs=30000` was near or greater
  than short measured sessions, so the loop did not rotate.

This is trigger-survival/correction evidence only, not completion improvement.

## Fake-shim Gate-gaming Candidate

Stage 15 scanned
`pairs/*/{OFF,ON}/post-finish.stderr.txt` in the accepted target archive and
found `21/30` post-finish stderr files with the fake Gradle/Spring gate shim
pattern plus `stack-alignment-mismatch`. Pair `pair-01/ON` is the named
`gradle-shim.js` / Node shim incident.

This remains a candidate adversarial measured case after forged-TDD detection,
not a broad reliability/product-efficacy claim.

## Stage 17 Workflow Loop Package-runtime Smoke

Accepted archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage17-workflow-loop-package-smoke-d4d85bc-20260704T092858Z`.

`ph workflow loop` is an explicit capped fresh-session blocker loop command.
The accepted smoke is package-runtime/command viability evidence only. It is
not completion-integrity, default-change, autonomous-completion, token-saving,
or product-efficacy evidence.

## Stage 18 Completion-integrity Main Rerun

Accepted archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage18-completion-integrity-main-rerun-20260704T105124Z`.

Prerecorded companion records:

- pilot-gated PARTIAL archive:
  `stage18-completion-integrity-3arm-20260704T093610Z`;
- repair/calibration archive:
  `stage18-repair-calibration-20260704T101436Z`.

Main rerun result on the finish-reachable Java/Spring/Gradle fixture:

| Condition | Final finish PASS | Marker/state | Cap hits | Mean blockers before -> after |
| --- | ---: | --- | ---: | --- |
| OFF | `0/10` | marker `0/10`, loop state `0/10` | `0` | `3 -> 2` |
| Internal tool-output trigger | `10/10` | marker `10/10` | `0` | `3 -> 0` |
| External `ph workflow loop` | `7/10` | loop state `10/10` | `3` | `3 -> 1.2` |

Paired exact sign comparisons:

- Internal vs OFF: wins `10`, losses `0`, ties `0`, one-sided
  `p=0.0009765625`.
- External vs OFF: wins `7`, losses `0`, ties `3`, one-sided
  `p=0.0078125`.

Interpretation: internal met the preregistered positive completion-integrity
criterion for this fixture. External met the finish PASS comparison criterion
but remains cap-risky because `3/10` rows hit iteration cap and did not finish.
No default change is made by this measurement.

## Stage 20 Finish Summary UX

Accepted archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage20-finish-summary-package-smoke-2f3625d-20260704T130812Z`.

Failed `ph workflow finish` human stderr now starts with a concise `Summary:`
before existing `Required fixes:` details. This is UX/measurement-support only;
gate semantics and JSON/machine-readable detail remain unchanged.

## Claim Boundary

None of the measurements above support token/provider-token saving, product
efficacy, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic role enforcement, production-ready delegation,
reliable automatic subagent orchestration, automatic completion/downgrade/removal,
or CodeGraph/LSP default/effectiveness.
