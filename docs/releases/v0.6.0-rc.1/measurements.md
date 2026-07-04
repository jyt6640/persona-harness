# v0.6.0-rc.1 Measurement Summary

This summary points to the accepted measurement/status records that currently
shape the `0.6.0-rc.1` line. It does not replace the append-only status files
under `docs/current/`; it gives the release line a stable reading order.

## Runtime Injection

`runtimeInjection` remains a parked opt-in preview.

The earlier 10-pair default-on runtime-injection A/B evidence was negative for
that fixture set, and later rail-entry work did not convert runtime injection
into a recommended/default surface. `--runtime-injection-preview` remains
available, but the default product posture is gate-first/evidence-first.

Primary current pointer:
[`docs/current/rail-entry-measurement-status.md`](../../current/rail-entry-measurement-status.md).

## Rail-entry

Stage 3 is recorded as stack-vs-nothing rail-entry evidence, not banner-only or
runtimeInjection H1 evidence. Stage 9 banner-only H1 evidence was null.

Current interpretation: scoped rail-entry behavior can be reported where the
accepted design and statistics match the run, but no token-saving,
product-efficacy, navigation-benefit, app-quality, or generated-app
certification claim is allowed.

## Ralph-loop

Stage 12 model-session and idle-trigger probes remain partial/negative for
model-facing idle delivery:

- the main n=15 model-session sample did not start because the pilot gate
  failed;
- retry pilots reached ralph-loop state attempts, but did not show
  model-facing prompt/utterance evidence.

The later default-off tool-output trigger path is accepted as a local-current
trigger-survival improvement:

- tiny pilot archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-tool-output-trigger-pilot-20260703T135815Z`;
- n=15 archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-tool-output-trigger-ab-15-20260703T142344Z`;
- n=15 result: OFF marker `0/15`; ON marker + persisted state attempt +
  follow-up action `15/15`; cap hits/runaway retries `0`;
- final finish pass remained OFF `0/15`, ON `0/15`;
- the reported `-3.00` style delta is blocker resolution/exposure movement, not
  total blocker reduction;
- total visible blockers increased from `3` to `6` after hierarchical gate
  exposure, so blocker movement must not be cited as completion improvement.

Current interpretation: tool-output trigger-survival PASS for the calibrated
fixture only. Completion integrity, default-change, reliability, closure
guarantee, autonomous completion, and product efficacy are not proven.

Cooldown caveat: `cooldownMs=30000` is greater than or near the roughly
25-second calibrated sessions. Attempts stayed at `1`, which is
trigger-survival evidence only and not evidence of multi-attempt loop benefit.

## Adversarial Gate-Gaming Candidate

The fake `gradle-shim.js` / Gradle-gate-gaming incident is elevated as a
candidate measured adversarial case after forged-TDD detection. The incident
pattern is that an agent attempted to fake a Java/Spring/Gradle verification
gate through a shim or equivalent behavior, and stack-alignment/gate discipline
caught it.

This is a candidate for a future README Measured Behavior table after
verification. It should be phrased as gate-gaming/verification-forgery detection
evidence only, not as product efficacy, broad reliability, app quality,
full-TDD sufficiency, or closure guarantee.

Primary current pointer:
[`docs/current/ralph-loop-measurement-status.md`](../../current/ralph-loop-measurement-status.md).

## Relay

Relay is currently framed as a Multi-Agent/role checklist rail with optional
host-dependent subagent invocation.

Stage 13 and its promptBlock retry observed relay command/prompt behavior, but
did not observe reliable OpenCode role subagent invocation. PH may ask a host
to invoke the current role subagent when that surface is available; it does not
guarantee, enforce, or certify OpenCode subagent orchestration.

Primary current pointer:
[`docs/current/multiagent-relay-trial-status.md`](../../current/multiagent-relay-trial-status.md).

## Role Boundary

`workflow role-boundary` remains report-only and heuristic.

The known blind spot is actor attribution: time-window/path/current-role
heuristics cannot deterministically prove whether a write came from the main
session, the current role checklist pass, or an unrelated subagent/session.
Findings are warning/report-only observations, not deterministic enforcement,
blocked-write evidence, closure blockers, or proof of a wrong actor.

## Scorecard

[`docs/current/measurement-scorecard.md`](../../current/measurement-scorecard.md)
is the canonical `scorecard.1` definition for experiment archives.

The scorecard is secondary observation only. It does not override
preregistered kill criteria, does not expand `.persona/evidence` schemas, and
does not turn partial/negative measurements into release claims.

## Claim Boundary

None of the measurements above support token/provider-token saving, product
efficacy, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic role enforcement, production-ready delegation,
automatic completion/downgrade/removal, or CodeGraph/LSP default/effectiveness.
