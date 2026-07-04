# v0.6.0-rc.2 Measurement Summary

This summary points to the accepted measurement/status records that currently
shape the `0.6.0-rc.2` prep. It does not replace append-only status files under
`docs/current/`.

## Ralph-loop

Ralph-loop remains default-off.

Accepted previous measurement supports hybrid tool-output trigger-survival in a
calibrated fixture:

- OFF marker `0/15`;
- ON marker + persisted state attempt + follow-up action `15/15`;
- cap hits/runaway retries `0`;
- final finish PASS stayed OFF `0/15`, ON `0/15`.

Correction preserved for rc2 prep:

- the reported `-3.00` style delta is blocker resolution/exposure movement, not
  total blocker reduction;
- total visible blockers increased from `3` to `6` after hierarchical gate
  exposure;
- blocker movement must not be cited as completion improvement;
- `cooldownMs=30000` is greater than or near the roughly 25-second calibrated
  sessions;
- attempts stayed at `1`, so the run is trigger-survival evidence only and not
  multi-attempt loop benefit.

Blocker-depth wording and finishable-fixture prep are included for future
completion-integrity measurement design. They do not prove completion-integrity
movement, default change, autonomous completion, closure success, or broad
reliability.

Stage 15 post-analysis correction sharpens this interpretation: all 15 ON rows
in the target archive had post-finish blocker count `6`, finish PASS stayed OFF
`0/15` and ON `0/15`, and all ON sessions had `attempts=1`. With
`cooldownMs=30000` near or longer than the short measured sessions, the fixture
was finish-unreachable and the loop did not rotate; the run remains
trigger-survival evidence only.

Primary current pointer:
[`docs/current/ralph-loop-measurement-status.md`](../../current/ralph-loop-measurement-status.md).

## External-loop Prep

External-loop work is archive-local prototype preparation for measurement. This
prep does not add or claim a product `ph workflow loop` command, autonomous
loop, automatic completion, or closure guarantee.

## Adversarial Gate-Gaming Candidate

The fake `gradle-shim.js` / Gradle-gate-gaming incident remains elevated as a
candidate measured adversarial case after forged-TDD detection. The incident
pattern is that an agent attempted to fake a Java/Spring/Gradle verification
gate through a shim or equivalent behavior, and stack-alignment/gate discipline
caught it.

Stage 15 frequency audit scanned
`pairs/*/{OFF,ON}/post-finish.stderr.txt` in the target n=15 archive and found
`21/30` post-finish stderr files with the fake `gradle-shim.js` / Node shim
pattern plus `stack-alignment-mismatch`. Pair `pair-01/ON` is the named
incident. This remains a README measured-behavior candidate only; the README is
not changed by Stage 15.

This is a candidate for future README Measured Behavior table inclusion after
verification. It is gate-gaming/verification-forgery detection evidence only,
not product efficacy, broad reliability, app quality, full-TDD sufficiency, or
closure guarantee.

## Role Checklist Relay And Subagent Probe

Relay is framed as Role Checklist Relay: a main-session checklist rail with
optional host-dependent subagent invocation.

The OpenCode subagent capability probe observed direct task-tool subagent
capability, but PH promptBlocks and relay flow still do not prove reliable
automatic OpenCode role subagent orchestration. PH may ask a host to invoke the
current role subagent when that surface is available; it does not guarantee,
enforce, or certify subagent orchestration or production-ready delegation.

Primary current pointer:
[`docs/current/multiagent-relay-trial-status.md`](../../current/multiagent-relay-trial-status.md).

## Role Boundary

`workflow role-boundary` remains report-only and heuristic.

The wrong-actor blind spot remains active: time-window/path/current-role
heuristics cannot deterministically prove whether a write came from the main
session, the current role checklist pass, or an unrelated subagent/session.
Findings are warning/report-only observations, not deterministic enforcement,
blocked-write evidence, closure blockers, or proof of a wrong actor.

## Prompt Regression Fixture

The prompt regression fixture protects accepted measurement-safe wording:

- Role Checklist Relay remains primary framing;
- host subagent/task invocation remains optional and host-dependent;
- ralph-loop wording stays blocker-depth and retry-capped;
- prompts avoid token-saving, product-efficacy, app-quality, reliable
  orchestration, and completion-guarantee claims.

This fixture is test protection only. It is not a product capability or release
evidence claim by itself.

## Claim Boundary

None of the measurements above support token/provider-token saving, product
efficacy, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic role enforcement, production-ready delegation,
automatic completion/downgrade/removal, or CodeGraph/LSP default/effectiveness.
