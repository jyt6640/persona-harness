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

## Boundaries

- This is measurement/probe evidence only.
- No token-saving, provider-token saving, product-efficacy, navigation-benefit,
  app-quality, full-TDD, broad reliability, closure guarantee, generated-app
  certification, autonomous completion, automatic downgrade, or automatic
  removal claim is made.
- Scorecard output is secondary and does not override preregistered kill
  criteria.
