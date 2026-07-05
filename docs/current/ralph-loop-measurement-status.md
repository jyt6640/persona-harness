# Ralph-loop Measurement Status

Status: Stage 12 partial; real model-session measurement is blocked at the pilot gate.

## HARDEN-1 H1-4 Toolchain-Dependent Convention Audit

H1-4 audits closure conventions before changing fail-closed behavior. The safe
implementation set is the intersection of explicit `block` level and
toolchain-dependent ast-grep conventions.

| Convention family / id | Toolchain dependency | Default level | H1-4 fail-closed applicability |
| --- | --- | --- | --- |
| `controller.repository-dependency` | none; built-in TypeScript observer | `block` | Not applicable; observer remains toolchain-independent. |
| `service.state-ownership` | none; built-in TypeScript observer | `block` | Not applicable; observer remains toolchain-independent. |
| `spring.bootjar-enabled` | none; built-in TypeScript observer | `block` | Not applicable; observer remains toolchain-independent. |
| `controller.persistence-import` | ast-grep / `sg` | `warn` | Applicable only when explicitly configured/effective level is `block`; default install remains skip+warning if `sg` is missing. |
| BYO `.persona/conventions/*.yml` ast-grep conventions | ast-grep / `sg` | metadata default `report` unless convention metadata says otherwise | Applicable only when explicitly/effective level is `block` and block eligibility remains valid. |

The audit found no default-install path that would add a new finish blocker
solely because ast-grep is missing: the built-in ast-grep convention defaults to
`warn`, while built-in `block` conventions use internal observers.

H1-4 therefore adds a walkable `convention-toolchain-missing` closure blocker
only for explicit block-level ast-grep/toolchain-dependent conventions when
`sg`/ast-grep is missing or the scan fails. The next step is to install
`sg`/ast-grep or set `PH_AST_GREP_BIN`, or lower that convention level to
`warn`/`report`, then rerun `npx ph workflow check`.

This is workflow foundation hardening only. It does not change defaults,
schemas, stable status, or any product-efficacy, reliability, app-quality,
closure-guarantee, deterministic-enforcement, or token-saving claim. The H1-0
real n>=5 rail-entry regression caveat remains open and stable GO is not
claimed.

## HARDEN-1 H1-2 Mechanical Finish Regression

H1-2 adds a permanent CI regression test for mechanical finish reachability. The
test creates a finish-reachable Java/Spring-shaped fixture, follows
`workflow closure next --json` steps through real PH closure/report/evidence and
read-coverage gates, and verifies `ph workflow finish implement` reaches PASS
within the current H1-3 chain-depth contract (`<= 6` steps).

The observed mechanical chain is implementation report fill -> review report
fill -> workflow evidence record -> report/read coverage record, finishing in
four steps. The test fails on repeated, unmapped, or immediate finish/check loop
steps, so H1-4/H1-5/H1-6 should run with this regression green.

This is workflow foundation hardening only. It uses no OpenCode/model sessions
and does not support a default change, completion-integrity measurement claim,
reliability claim, product-efficacy claim, app-quality claim, or token-saving
claim. The H1-0 real n>=5 rail-entry regression caveat remains open and stable
GO is not claimed.

## HARDEN-1 H1-3 Chain-Depth Contract

H1-3 records the current finish-reachable gate-chain depth as `6` and locks it
with workflow closure tests. The chain-depth contract is used only to keep the
default-off ralph-loop retry/session budget explainable: `maxAttempts=3` remains
the per-blocker cap and `maxSessionAttempts=9` remains above the current chain.

This is workflow foundation hardening, not a default-change, completion,
reliability, product-efficacy, app-quality, or token-saving claim. The H1-0 real
n>=5 rail-entry regression caveat remains open and stable GO is not claimed.

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

## Trigger Design Review After Stage 12 Retry

Status: design review complete; no product behavior change in this record.

Evidence read:

- Stage 12 retry archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-trigger-survival-pilot-20260703T102108Z`.
- `summary.json` recorded two valid ON pilots with
  `.persona/workflow/ralph-loop-state.json` attempts `2`, clean OpenCode exits,
  and `modelFacingContinuation=false`.
- `RESULT.md` recorded the same failure mode: PH reached
  `continueIfBlocked`, but raw OpenCode JSONL and isolated OpenCode store search
  did not show model-facing `[Persona Harness Ralph Loop]` continuation prompt
  evidence.
- Source inspection: `src/runtime/hooks.ts:221-249` fires ralph-loop only from
  `session.idle`; `src/runtime/ralph-loop.ts:208-225` writes state before
  calling `sendPrompt`; `src/runtime/ralph-loop.ts:231-239` calls
  `client.session.promptAsync` and treats API completion as `prompt-sent`.

Observed failure mode:

- `session.idle` delivery is late in the run lifecycle for `opencode run`.
- PH can persist a ralph-loop attempt and call `promptAsync`, but the current
  pilot did not prove that the prompt is delivered into a model turn the same
  `opencode run` process will consume.
- Therefore, `prompt-sent` is currently an API-acceptance/status label, not a
  model-facing delivery proof.

Candidate trigger surfaces:

| Surface | Model-facing delivery potential | Main risks | Verification gate |
| --- | --- | --- | --- |
| Keep `session.idle` + `promptAsync` | Unproven in `opencode run`; plausible only if the host keeps the session alive for another model turn. | State can advance without observable prompt delivery; repeated n=15 runs would measure trigger absence again. | Add a delivery check before counting an attempt as exercised, then pilot. |
| `tool.execute.after` for PH finish/check blocker output | Strongest candidate. The `ph workflow finish implement` or `workflow check` blocker text is tool output returned to the model before it decides whether to stop. `src/runtime/hooks.ts:252-317` already modifies tool output for other PH runtime guidance. | Must be default-off, scoped only to PH closure/check command outputs, retry-capped, session-classified, and must not create closure blockers or fake completion. | Tiny pilot where raw OpenCode JSONL shows `[Persona Harness Ralph Loop]` appended to blocker tool output and the model performs one bounded follow-up action. |
| `experimental.text.complete` | Can append visible text to the assistant response (`src/runtime/hooks.ts:366-383`, `src/runtime/continuation.ts:127-154`). | It modifies completed assistant text, not necessarily the model's next input. Current hook is tied to `runtimeInjectionEnabled`, so using it for ralph-loop would require careful decoupling. It is better as delivery/status instrumentation than as the primary resume trigger. | Pilot can verify visible appended text, but resumed model continuation still needs separate proof. |
| `experimental.chat.messages.transform` | Strong model-input surface before a turn. | It runs before the model declares blockers, so it cannot react to freshly observed closure blockers in the same turn. It risks becoming runtimeInjection-style banner work rather than blocker-driven continuation. | Not recommended for ralph-loop execution unless used only for a pre-existing persisted blocker at the start of a new turn. |
| `chat.message` / `chat.params` / `chat.headers` | Typed plugin surfaces expose `agent` and session context in `node_modules/@opencode-ai/plugin/dist/index.d.ts`. | These surfaces adjust incoming message/provider parameters, not post-blocker continuation delivery. They are useful for classification/instrumentation, not the primary trigger. | Defer unless a later role/session identity task needs them. |
| OpenCode compaction hooks | Host-specific lifecycle hooks exist, but they are for compaction prompts/autocontinue, not ordinary closure blockers. | Wrong lifecycle; would couple ralph-loop to compaction. | Not recommended. |

Recommendation:

- Do not run another `session.idle` n=15 measurement yet.
- Implement a default-off hybrid trigger candidate for a new pilot:
  1. Primary trigger: `tool.execute.after` observes PH `workflow finish
     implement` / `workflow check` outputs that contain deterministic closure
     blockers, then appends the existing ralph-loop continuation prompt to that
     tool output.
  2. Fallback trigger: keep `session.idle + promptAsync`, but count it as
     exercised only when delivery is observed in raw logs or a delivery marker.
  3. Keep Stage 1B/8B main-session classification and fail-closed behavior for
     subagent/unknown sessions.
  4. Reuse the persisted ralph-loop state and retry caps; do not add a new
     evidence schema.
  5. Run a tiny pilot before any n=15: setup validity, raw JSONL marker in tool
     output, state attempt, and one bounded model follow-up action must all be
     present.

If the tool-output pilot fails to show a model-facing marker or follow-up
action, park ralph-loop execution until OpenCode provides a reliable
post-blocker continuation surface. If it succeeds, the next measurement should
still be trigger-survival first, not completion-effectiveness or default-change
evidence.

## Tool-Output Trigger Implementation and Tiny Pilot

Status: default-off implementation plus tiny pilot complete; no n=15
measurement was run.

- Archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-tool-output-trigger-pilot-20260703T135815Z`.
- Package source: local-current tarball from the Stage implementation worktree,
  package version `0.6.0-rc.1`, tarball shasum
  `54e0d0f6ab7134d4ea0b26303cdb5cd1cb3dc23c`.
- Config policy: `enforce.ralphLoop.toolOutputTrigger=false` by default. The
  pilot explicitly set `enforce.ralphLoop.enabled=true`,
  `enforce.ralphLoop.toolOutputTrigger=true`, `enforce.idleContinuation=false`,
  `features.runtimeInjection=false`, and `multiAgent.enabled=false`.
- Runtime scope: the tool-output trigger is limited to deterministic PH
  blocker-producing command outputs such as `ph workflow finish implement` and
  `ph workflow check`. It appends
  `[Persona Harness Ralph Loop Tool Continuation]` plus the existing
  ralph-loop continuation prompt to eligible tool output, reuses persisted
  ralph-loop retry caps/state, and suppresses the `session.idle` fallback while
  the tool-output trigger is enabled to avoid duplicate prompts.
- Dry-run/reporting: `ph workflow ralph-loop --json` now reports
  `workflow-ralph-loop.4` with the active runtime surface and
  `toolOutputTriggerEnabled`.

Pilot gate result:

- Setup validity: PASS.
- OpenCode clean exit: PASS.
- Raw OpenCode JSONL marker observed: PASS.
- `.persona/workflow/ralph-loop-state.json` attempt count: `1`.
- Follow-up actions after marker: `13` tool calls, including later `write` and
  `bash` calls.

Judgment: PASS for the tiny trigger-survival pilot only. The pilot demonstrates
that the marker can be returned through tool output and that the same model
session can continue with bounded follow-up actions afterward. It does not
measure n=15 completion integrity, does not support a default change, and does
not make a token, product-efficacy, app-quality, reliability, closure-success,
or autonomous-completion claim.

## Tool-Output Trigger n=15 Measurement

Status: trigger-survival criterion met for the calibrated fixture; no default
change is supported by this record.

- Archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-tool-output-trigger-ab-15-20260703T142344Z`.
- Source package: local-current tarball from commit
  `5cdeb692b278f498f0c81b903bb6100791c13022`, version `0.6.0-rc.1`,
  shasum `b2bab6805d840bdd19b2fd07ba030d467442db5e`.
- Excluded aborted archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-tool-output-trigger-ab-15-20260703T142028Z`.
  That first runner attempt was stopped after the archive-local parser counted
  the marker literal in `TASK.md` read output. It is marked `ABORTED` and must
  not be used as evidence.

Design:

- n=15 paired OFF/ON rows, pair-internal sequential, concurrency 1.
- OFF: PH installed and bootstrapped, `runtimeInjection=false`,
  `multiAgent=false`, `idleContinuation=false`, `ralphLoop.enabled=false`, and
  `toolOutputTrigger=false`.
- ON: same setup with `ralphLoop.enabled=true` and
  `toolOutputTrigger=true`.
- Marker detection was strict: only marker text returned in PH
  `workflow finish implement` / `workflow check` tool output counted as
  delivery evidence.
- Primary criterion: ON marker + persisted state attempt + follow-up action in
  at least 12/15 rows, OFF marker 0/15, and zero ON runaway retries/session cap
  hits.

Results:

- Valid comparable pairs: 15/15.
- Clean OpenCode exits: OFF 15/15, ON 15/15.
- OFF marker observed: 0/15.
- ON marker + state + follow-up observed: 15/15.
- ON ralph-loop state attempts: 15/15 rows had attempts; each observed attempt
  count was `1`.
- ON session cap hits: 0.
- ON runaway retries: 0.
- Mean elapsed snapshot: OFF 23943 ms, ON 24396 ms.
- Mean provider token total snapshot: OFF 55090, ON 70143. These are telemetry
  snapshots only and do not support any token-saving claim.
- Final `workflow finish implement` pass rate after the run: OFF 0/15, ON
  0/15.
- Mean blocker-count delta did not improve: OFF -1.20, ON -3.00 by the archive
  runner's `firstFinishBlockers - postFinishBlockers` calculation.

Judgment: PASS for trigger-survival in this calibrated fixture. The tool-output
trigger reliably delivered a model-facing marker and the model performed
bounded follow-up actions after the marker. Completion-integrity movement is
not positive by final finish pass, and the blocker-count snapshot does not
support an improvement claim. Ralph-loop remains default-off; any larger
completion-integrity or default-change trial must be separately preregistered.

## Correction: Blocker Delta Interpretation

The reported `-3.00` style delta is blocker resolution/exposure movement from
the archive runner's `firstFinishBlockers - postFinishBlockers` calculation.
Do not describe it as total blocker reduction or completion improvement.

In the calibrated n=15 run, total visible blockers increased from `3` to `6`
after hierarchical gate exposure. That increase can happen when a later gate
reveals additional underlying blockers after an earlier blocker is addressed or
surfaced differently. It is not evidence that ralph-loop improved completion.

The completion result is unchanged: final `workflow finish implement` PASS
stayed OFF `0/15` and ON `0/15`. Completion-integrity movement and any default
change remain unproven.

## Design Caveat: Cooldown And Short Sessions

`cooldownMs=30000` is greater than or near the short calibrated session length
of roughly 25 seconds. In short sessions, a time-based cooldown can effectively
disable loop rotation or multi-attempt behavior.

The calibrated measurement observed attempts staying at `1`. That supports
trigger-survival for the tool-output delivery path, but it is not evidence of
multi-attempt loop benefit. Future completion-integrity fixtures should account
for session duration, cooldown behavior, blocker changes, and retry rotation
before using ralph-loop as more than a default-off trigger-survival preview.

## Stage 15 Post-analysis Correction

This is an append-only correction for archive
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/ralph-loop-tool-output-trigger-ab-15-20260703T142344Z`.

`blockerDelta -3.00` is the archive runner's resolution count for initially
named blockers and exposure movement, not total blocker reduction. The actual
ON post-finish blocker count was `6` in all 15 ON rows. Visible blockers
therefore increased from `3` to `6` after hierarchical closure gates exposed
deeper gates, including `verification-unknown`, review-report,
coverage-related blockers, and stack-alignment.

Completion improvement remains unproven: final `workflow finish implement`
PASS stayed OFF `0/15` and ON `0/15`. Reclassification: this calibrated
fixture was finish-unreachable for the measured run, and the loop did not
rotate. All 15 ON sessions had `attempts=1`; with `cooldownMs=30000` greater
than or near the roughly `25s` session length, the time-based cooldown
structurally prevented multi-attempt loop rotation in this fixture. This is
trigger-survival evidence only, not multi-attempt loop benefit and not a
default-change result.

## Stage 15 Fake-shim Frequency Audit

Method: scanned the target archive's pair post-finish stderr files with glob
`pairs/*/{OFF,ON}/post-finish.stderr.txt` and searched for the
case-insensitive pattern `gradle-shim|Node shim`, then required
`stack-alignment-mismatch` in the same file for the counted shim/gate-gaming
case.

Count: `21/30` post-finish stderr files contained the fake Gradle/Spring gate
shim pattern and `stack-alignment-mismatch`.

Pair `pair-01/ON/post-finish.stderr.txt` is the named incident: the agent
attempted a fake `gradle-shim.js` / Node shim path to satisfy gates, and
stack-alignment caught it with `stack-alignment-mismatch`, Java/Spring/Gradle
missing build/source evidence, Node/CommonJS markers, and the remediation line
to remove fake `gradle-shim.js` / Node shim files.

Release-decision candidate only: after separate verification, this may become a
README Measured Behavior row such as `Faked build shim to satisfy gates ->
caught by stack-alignment`. Stage 15 does not modify the README table and does
not turn the incident into a broad product-efficacy, reliability, deterministic
enforcement, generated-app certification, or automatic-removal claim.

## Stage 17 Finish-Reachable Fixture And Workflow Loop Prep

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage17-workflow-loop-fixture-20260704T090750Z`.

Fixture validity: PASS. The archive-local Spring/Gradle fixture starts from an
implementation-complete state and completes the procedural PH gate chain:
implementation report fill, `gradle test --no-daemon` warm verification,
`npx ph bearshell gradle test --no-daemon`, review report fill, and
`ph workflow finish implement` exit `0`. This proves fixture reachability only;
it is not product efficacy, app-quality, or full-TDD evidence.

Product prep: `ph workflow loop` now exists as an explicit capped
fresh-session blocker loop command. It reads deterministic
`workflow finish implement` / `workflow closure next --json` state, builds a
minimal prompt containing the current blocker, next action, and blocker
depth/total, runs a fresh `opencode run` session per iteration, and persists
`.persona/workflow/workflow-loop-state.json`. Termination is deterministic:
finish PASS, no blockers, or iteration cap. It is not a hook and does not
change defaults.

Pilot: PASS for command/host viability only. The controlled blocked fixture
ran the product command through a real OpenCode wrapper for two iterations and
terminated by `iteration-cap`; both iteration child exits were `0`, no timeout
was recorded, and the persisted state contained two iteration records. The
pilot did not prove completion improvement.

Stage 18 recommendation: GO to design a separate preregistered
three-condition measurement only after accepting this prep surface and fixture
validity. The primary future metric should remain finish PASS rate, with
token/elapsed snapshots treated as secondary telemetry only.

## Stage 18 Preregistered Completion-Integrity Measurement

Status: PARTIAL. The preregistered main n=10-15 measurement was not run because
the pilot gate did not pass.

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage18-completion-integrity-3arm-20260704T093610Z`.

Package source: local-current tarball from commit
`d4d85bc9f36a6b345c0065aba9fb5fb0e4e5c876`, version `0.6.0-rc.2`,
shasum `bd6b48368c24f6564ecb231c18ed0a06bac9281c`, pack entry count
`594`.

Preregistration: `measurement-plan.json` and `KILL_CRITERIA.md` were written
before measured rows. The primary metric was final
`ph workflow finish implement` PASS rate, and the main sample was allowed only
after a three-condition pilot proved setup validity, strict finish parsing,
the internal tool-output marker/state path, and the external loop state path.

Fixture validity: PASS. The scripted gate-chain path reached
`ph workflow finish implement` exit `0`, proving the generated fixture can be
finish-reachable when the required procedure is followed. This is fixture
validity only, not product efficacy evidence.

Pilot result:

- OFF: final finish PASS `0/1`, blockers `3 -> 3`, no marker.
- Internal tool-output trigger: final finish PASS `0/1`, blockers `3 -> 3`,
  no tool-output marker and no persisted ralph-loop attempt.
- External `ph workflow loop`: final finish PASS `0/1`, blockers `3 -> 3`,
  `workflow loop` ran three iterations and terminated by `iteration-cap`.

Pilot judgment: NO-GO for the main Stage 18 sample. The accepted pilot exposed
fixture/runner calibration problems: model sessions repeatedly treated the
workspace as PH/package-root or followed mismatched fixture context, and the
external loop still capped without finish PASS. Earlier invalid archive-local
runner attempts are marked under `aborted/` and excluded from evidence.

Decision: no completion-integrity conclusion and no default change are
supported. Before any future n=10-15 completion-integrity run, the measurement
fixture/runner should be repaired so model sessions operate unambiguously
inside the generated Java fixture and both continuation arms pass their pilot
readiness checks.

## Stage 18 Repair/Calibration

Status: PASS for calibration readiness only. The main n=10-15 measurement was
not run in this task.

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage18-repair-calibration-20260704T101436Z`.

Package source: local-current tarball from commit
`84c81f54d6327e043388922e8338d54095300abe`, version `0.6.0-rc.2`,
shasum `018911d54d04a3e1f28fe4213316f65deda54ea9`, pack entry count `594`.

Diagnosis:

- The accepted Stage 18 pilot-gated PARTIAL used an archive-local runner that
  passed `cwd` but inherited `PWD` and did not pass OpenCode `--dir`, so
  OpenCode operated from `/Users/yongtae/Desktop/persona-harness` rather than
  the generated Java fixture.
- The generated fixture also lacked a Spring Boot `main` method, so model
  sessions spent time repairing app startup before gate-chain work.

Calibration repairs were archive-local only:

- set child process `PWD` to the per-run fixture root;
- call `opencode run --dir <fixture-root>`;
- make the fixture root explicit in the prompt;
- generate `Stage18Application.main` up front;
- add tiny readiness modes for the internal tool-output marker path and the
  external `ph workflow loop` path.

Calibration observations:

- Fixture validity PASS: scripted `ph workflow finish implement` exit `0`.
- Internal tool-output trigger readiness PASS: raw OpenCode stderr contained
  `[Persona Harness Ralph Loop Tool Continuation]`, persisted ralph-loop state
  recorded `4` attempts, and final finish passed in the tiny pilot.
- External easy prompt finished before `ph workflow loop` could iterate, so it
  was not loop-readiness evidence.
- Targeted external-loop readiness PASS for state/iteration path: the initial
  session stopped after the first finish blockers, then `ph workflow loop`
  recorded `3` concrete iterations and persisted loop state. It still ended at
  `iteration-cap` with final finish not passing, so completion improvement is
  not proven.

Decision: the fixture-root repair, internal marker/state path, and external
loop state/iteration path are ready for a separately approved Stage 18 main
rerun. Before that rerun, the external loop cap/prompt should be reviewed
because the targeted external-loop probe still capped before finish PASS. No
completion-integrity conclusion, default change, or product claim is supported
by this calibration record.

## Stage 18 Main Rerun

Status: PASS for the preregistered completion-integrity measurement on this
finish-reachable fixture. This is not a default-change or broad product claim.

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage18-completion-integrity-main-rerun-20260704T105124Z`.

Package source: local-current tarball from commit
`9328adb72c2c763a48c076ef49a9d972b510b081`, version `0.6.0-rc.2`,
shasum `30ce7628f8e1835833529dfdb5d9433281973da8`, pack entry count `594`.

Preregistration:

- `measurement-plan.json` and `KILL_CRITERIA.md` were written before measured
  rows.
- Primary metric: deterministic final `ph workflow finish implement` PASS
  rate.
- Main sample: n=10 valid paired/counterbalanced 3-arm rows.
- Completion proof: model text was never counted as completion.

Preflight:

- Fixture validity PASS: scripted gate-chain path made
  `ph workflow finish implement` exit `0`.
- Internal readiness PASS: tool-output marker observed, persisted ralph-loop
  state present, finish PASS.
- External readiness passed with caveat: workflow-loop state existed and
  blocker progress was observed, but the external arm remained cap-risky.

Main result:

| Condition | Final finish PASS | Marker observed | Loop state | Cap hits | Mean blockers before -> after |
| --- | ---: | ---: | ---: | ---: | --- |
| OFF | `0/10` | `0/10` | `0/10` | `0` | `3 -> 2` |
| Internal tool-output trigger | `10/10` | `10/10` | `0/10` | `0` | `3 -> 0` |
| External `ph workflow loop` | `7/10` | `0/10` | `10/10` | `3` | `3 -> 1.2` |

Paired exact sign comparisons:

- Internal vs OFF: wins `10`, losses `0`, ties `0`, one-sided
  `p=0.0009765625`.
- External vs OFF: wins `7`, losses `0`, ties `3`, one-sided
  `p=0.0078125`.

Decision:

- Internal met the preregistered positive completion-integrity criterion for
  this fixture.
- External also met the finish PASS comparison criterion, but with a material
  cap-risk caveat: `3/10` external rows hit iteration cap and did not finish.
- No default change is made by this measurement. Any release/default decision
  remains a separate product decision.

## HARDEN-1 H1-0 Cost Per Verified Completion Telemetry

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/harden-h1-0-stable-preflight-20260704T140126Z`

Source measurement archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage18-completion-integrity-main-rerun-20260704T105124Z`

Source token files: `.persona/evidence/token-usage/*.json` under each Stage 18
run root. All 30 main rows had provider token evidence with `aggregate.total`;
no token rows were missing.

Requested H1-0 formula: condition mean provider total tokens divided by finish
PASS count. OFF has finish PASS `0/10`, so its value is `∞`.

| Condition | Finish PASS | Mean provider total tokens | Requested formula result | Audit total tokens / PASS |
| --- | ---: | ---: | ---: | ---: |
| OFF | `0/10` | `19204` | `∞` | `∞` |
| Internal tool-output trigger | `10/10` | `604853.5` | `60485.35` | `604853.5` |
| External `ph workflow loop` | `7/10` | `592008.3` | `84572.61` | `845726.14` |

Aggregate provider token fields across all rows:

| Condition | Input | Output | Reasoning | Cache read | Cache write | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| OFF | `65646` | `2339` | `2199` | `121856` | `0` | `192040` |
| Internal tool-output trigger | `343133` | `63450` | `48864` | `5593088` | `0` | `6048535` |
| External `ph workflow loop` | `603915` | `74463` | `64361` | `5177344` | `0` | `5920083` |

Interpretation: this is cost-per-verified-completion telemetry only. It does
not support token-saving, provider-token-saving, product-efficacy,
navigation-benefit, app-quality, broad reliability, closure-guarantee,
autonomous-completion, or default-change claims.

## Stable Cycle S-0 H1-0c Confirmation

S-0 confirmed that H1-0c tokens-per-verified-completion telemetry was already
calculated and recorded above using the requested formula: condition mean total
provider tokens divided by finish PASS count. The recorded values are:

- OFF: finish PASS `0/10`, mean total `19204`, cost per verified completion
  `∞`.
- Internal tool-output trigger: finish PASS `10/10`, mean total `604853.5`,
  cost per verified completion `60485.35`.
- External `ph workflow loop`: finish PASS `7/10`, mean total `592008.3`,
  cost per verified completion `84572.61`.

This remains cost-per-verified-completion telemetry only, not token/provider
token saving evidence, product-efficacy evidence, app-quality evidence, broad
reliability evidence, closure-guarantee evidence, or default-change evidence.

## LEAN-1 L-0 Baseline Token/Time Profile

Status: PASS for baseline telemetry collection only. No optimization was
implemented.

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/lean-l0-baseline-profile-20260705T152205Z`.

Source/package facts:

- Source commit: `0b33632bd814c74e95d4e47d4207b2cb91faa00d`.
- Local-current package: `persona-harness-0.6.0.tgz`.
- Package shasum: `6338a713855b4b46b9d5f04d9f8c1a06b960db3e`.
- Package entry count: `665`.
- OpenCode: `1.17.7`.

Design:

- n=5 current full-cycle rows using the Stage 18 finish-reachable fixture
  lineage.
- Archive-local instrumentation only: copied fixture package files logged
  `loadHarnessConfig` calls and `tool.execute` events. No product/runtime
  behavior change was committed.
- Phase token attribution is mechanical: each assistant token message is
  assigned to the latest preceding traced `tool.execute.after` command phase;
  messages before any command are assigned to implementation.
- The archive parse sweep validated `120` measurement JSON/JSONL artifacts and
  skipped `1651` vendored `node_modules` JSON/JSONC files.

Baseline result:

| Metric | Value |
| --- | ---: |
| Valid rows | `5/5` |
| Finish PASS | `5/5` |
| Ralph-loop tool-output marker observed | `5/5` |
| Mean total tokens/run | `798757.2` |
| Mean input/cacheRead/output/run | `50861.4 / 735744 / 7060.2` |
| Mean turns/run | `27.8` |
| Mean elapsed/run | `264095.2ms` |
| Mean tool calls/run | `47.8` |
| Mean `loadHarnessConfig` calls/run | `189.2` |
| Executable Gradle/bearshell invocations | `16` |
| Mean executable Gradle/bearshell elapsed | `400.5ms` |

Mean token totals by phase:

| Phase | Mean total/run | Share | Mean input/cacheRead/output |
| --- | ---: | ---: | --- |
| implementation | `213094` | `26.7%` | `20772.8 / 188723.2 / 2044.2` |
| reports | `141861.4` | `17.8%` | `7018.6 / 132608 / 1318.6` |
| verification | `196965.2` | `24.7%` | `8861.6 / 183910.4 / 2345.2` |
| finish | `246836.6` | `30.9%` | `14208.4 / 230502.4 / 1352.2` |
| unassigned | `0` | `0%` | `0 / 0 / 0` |

Rule delivery snapshot:

| Delivery point | Mean rule count | Mean chars | Estimated token share |
| --- | ---: | ---: | ---: |
| relay | `0` | `305` | `0%` |
| loop | `0` | `305` | `0%` |
| ticket | `0` | `305` | `0%` |

Decision input:

- This is the L-1/L-2/L-3 baseline.
- Rule delivery was already negligible by this fixture/profile (`0.00%` of
  mean total tokens), so L-3 rule-delivery optimization should be lower
  priority than host config parsing and prompt/output cache-friendliness unless
  a later fixture shows a larger delivered-rule share.

## Boundaries

- This is measurement/probe evidence only.
- No token-saving, provider-token saving, product-efficacy, navigation-benefit,
  app-quality, full-TDD, broad reliability, closure guarantee, generated-app
  certification, autonomous completion, automatic downgrade, or automatic
  removal claim is made.
- Scorecard output is secondary and does not override preregistered kill
  criteria.
