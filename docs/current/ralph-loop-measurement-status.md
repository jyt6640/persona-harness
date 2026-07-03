# Ralph-loop Measurement Status

Status: Stage 12 partial; real model-session measurement is blocked at the pilot gate.

## Stage 12 Real Model-Session A/B

- Archive: `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-model-ab-15-20260703T090715Z`
- Source package: local-current tarball from `persona-harness@0.5.0`, package shasum `6cf87a0bb149bc6a8304dba632d83f5066118cb6`
- Design target: one pilot pair before the main n=15 paired sample.
- OFF setup: tarball install, bootstrap exit 0, `runtimeInjection=false`, `idleContinuation=false`, `ralphLoop.enabled=false`, `multiAgent=false`.
- ON setup: same setup with `ralphLoop.enabled=true`, `maxAttempts=3`, `maxSessionAttempts=9`, `cooldownMs=30000`.

Pilot setup validity passed for both conditions, but the pilot gate failed:

- OFF did not clean-exit and timed out at the 300000 ms OpenCode cap.
- ON did not clean-exit and produced no `.persona/workflow/ralph-loop-state.json` attempt.
- ON did not show a ralph-loop prompt observation in the OpenCode JSONL.
- The main n=15 sample was not started.

Scorecard outputs were generated for the pilot only:

- `pilot/scorecard.json`
- `pilot/SCORECARD-RESULT.md`

## Judgment

Stage 12 is PARTIAL/deferred. It does not provide measured evidence that
ralph-loop improves real model-session completion integrity, and it does not
support a default change.

The immediate blocker is scenario/lifecycle exercise: the pilot did not reach a
real idle-to-ralph-loop continuation path. The ON model session continued active
Gradle/JDK troubleshooting instead of reaching an idle continuation point before
the run was terminated, so the ralph-loop execution path was not exercised.

Default decision state: `enforce.ralphLoop.enabled=false` remains unchanged.
Ralph-loop remains a default-off preview/parked continuation surface until a
new real-session fixture can reliably exercise idle continuation and then run a
valid paired sample.

## Stage 12 Retry: Trigger-Survival Pilot

- Archive: `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-trigger-survival-pilot-20260703T102108Z`
- Source package: registry `persona-harness@next=0.6.0-rc.1`, gitHead `b673633533a314e1a64dd6dcb18c4097c5889a2c`, shasum `5c8bcd5c1bd4165dd129e39624408672f88091ce`.
- Runner repair: archive-local measurement runner uses detached process-group `SIGTERM`, bounded 5000 ms grace, then `SIGKILL`.
- Pilot 1 fixture: one-blocker transition.
- Pilot 2 fixture: smaller finish-only blocker observation.

Both retry pilots had valid OFF/ON setup and clean OpenCode exits. In both ON
pilots, `.persona/workflow/ralph-loop-state.json` existed with two attempts,
while OFF had zero attempts. That shows the ralph-loop runtime hook reached
`continueIfBlocked`.

The retry still failed the preregistered pilot gate because neither ON pilot
showed model-facing ralph-loop prompt/utterance evidence in raw OpenCode JSONL
or isolated OpenCode store search. The main n=15 sample was not run.

Retry judgment: PARTIAL trigger-survival signal only. The hook/state path can
fire, but observable `idle -> ralph-loop utterance -> resumed continuation` was
not proven. The next step should be trigger design review, for example
`experimental.text.complete` or blocker-declaration/continuation hook placement,
before another n=15 real-session measurement.

## Boundaries

- This is measurement/probe evidence only.
- No token-saving, provider-token saving, product-efficacy, navigation-benefit,
  app-quality, full-TDD, broad reliability, closure guarantee, generated-app
  certification, autonomous completion, automatic downgrade, or automatic
  removal claim is made.
- Scorecard output is secondary and does not override preregistered kill
  criteria.
