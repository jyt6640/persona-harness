# OMO STEAL Measurement Report

Status: evidence-bound measurement report, not a token-saving claim.

This report summarizes the PH-owned measurement, compaction, and hashline feasibility work through the stable same-session compaction lifecycle follow-up. It includes the R1/R2 telemetry and compaction mechanics stack through `0599215`, the summarize binding fix in `75c7f38`, the stable same-session compaction scenario recorded at `b7b5a20`, and the follow-up durable cooldown fix. It does not claim OMO parity, codegraph replacement, provider-token savings, product efficacy, broad reliability, or closure guarantees.

## Scope

- Target: PH-owned mechanisms only.
- Included: token telemetry, default-off compaction trigger mechanics, plugin-loading probe, real-provider compaction probe.
- Excluded: code-nav changes, multi-agent dispatch, codegraph indexer work, version bump, publish/tag/latest changes.
- Required boundary for real-provider probes: OMO/codegraph off, no `.codegraph` in probe workspaces, and isolated OpenCode config where PH project plugin is the only external plugin.

## R0 Feasibility

| Lever | Verdict | Evidence summary | Keep/defer |
| --- | --- | --- | --- |
| Token telemetry | Possible-constrained | `node_modules/@opencode-ai/plugin/dist/index.d.ts:173-178` exposes plugin `event` hooks. `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:129-134` maps `message.updated` to `Message`; `98-127` has assistant provider/model/token fields. | Keep as measurement infrastructure only. |
| Compaction trigger | Possible-constrained | `node_modules/@opencode-ai/plugin/dist/index.d.ts:36-45` passes the SDK client to plugins. `node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts:163-166` exposes `session.summarize`. `types.gen.d.ts:2175-2190` defines summarize request shape. | Default-off until real measured benefit exists. |
| Hashline edit routing | Not feasible for hard route | `node_modules/@opencode-ai/plugin/dist/index.d.ts:225-241` and `types.gen.d.ts:369-383` show permission payload lacks proposed write content/path needed for content-aware routing. | Defer/no-go for enforced routing. |

R0 evidence file: `.persona/evidence/omo-steal-feasibility.json`.

## R1 Token Telemetry

Commit: `163a85e` (`fix(runtime): record token telemetry evidence`).

Behavior:

- Records latest assistant `message.updated` token usage per message/session.
- Writes ignored evidence under `.persona/evidence/token-usage/<session>.json`.
- Aggregates input/output/reasoning/cacheRead/cacheWrite/total.
- Records `modelLimit` and ratio only when known; otherwise leaves ratio unknown.
- Deduplicates repeated message updates by message/session.

QA and External verified the package surface. This is measurement infrastructure only; it does not claim reductions.

## R2 Trigger Mechanics

Commit: `a011678` (`fix(runtime): add measured compaction gate`).

Behavior:

- Adds default-off `enforce.compaction`.
- Uses R1 telemetry ratio, threshold, and cooldown to decide whether to call host `session.summarize`.
- Writes ignored evidence under `.persona/evidence/compaction/<session>.json`.
- Records skip/failure/trigger attempts and before/after measurement availability.

QA and External verified trigger mechanics. Effectiveness remained explicitly unproven before the real-provider probe below.

## Plugin Loading Probe

Evidence file: `.persona/evidence/opencode-plugin-loading-probe.json`.

Result:

- `opencode run --pure` disables external plugins, including the PH project plugin; this mode cannot measure PH telemetry or compaction hooks.
- Safe mode found: non-pure OpenCode with isolated `HOME` and `XDG_*` directories, workspace `.opencode/opencode.json` pointing only to the PH plugin, no `.codegraph`, and OMO/codegraph environment disabled.
- A tiny run with `opencode/north-mini-code-free` wrote PH token evidence, proving PH hook execution without global plugin/codegraph contamination.

## R2 Real-Provider Compaction Probe

Summary evidence: `.persona/evidence/r2-compaction-effectiveness-2026-06-30T18-56-27-208Z.json`.

Raw logs: `.persona/evidence/r2-compaction-effectiveness-2026-06-30T18-56-27-208Z-raw/`.

Method:

- Source: local/current package from HEAD `0599215`; registry `@next` was not used.
- Model: `opencode/north-mini-code-free`.
- Mode: safe isolated non-pure mode from the plugin-loading probe.
- Control: token telemetry on, compaction off.
- ON: token telemetry on, compaction on with threshold `0.000001` and cooldown `3600000`.
- Prompt shape: two short continuation messages. Clean comparison workspaces used `enabledDomains: []` and `enforce.systemConstitution: false` to keep PH event hooks active without workflow-rail prompt dominance.
- Codegraph boundary: compared workspaces recorded `NO_CODEGRAPH`; `PH_R0_CODEGRAPH_OFF=1`, `OMO_SPARKSHELL_SESSION_CONTEXT=0`, `OMO_SPARKSHELL_SPARK=0`, `CODEGRAPH_DISABLED=1`, and `CODEX_THREAD_ID` unset.

Measured conditions:

| Condition | Step status | Session | Cache read | Input | Reasoning | Total | Ratio | Compaction evidence |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Control/default-off | step1 `0`, step2 `0` | `ses_0e6202e8cffeIk0SHtPknWpCTO` | 0 | 37,322 | 1,362 | 38,684 | 0.145789 | No compaction file, as expected. |
| ON/compaction enabled | step1 `0`, step2 `0` | `ses_0e61e4dd9ffe3ilZplCaHVoyF0` | 0 | 14,891 | 464 | 15,355 | 0.058168 | Attempted summarize twice; both failed before trigger. |

ON compaction attempts:

- Initial event skipped: `ratio-unavailable`.
- First measured attempt failed: `undefined is not an object (evaluating 'this._client')`, with request `{ providerID: "opencode", modelID: "north-mini-code-free", session id, directory }`.
- Cooldown skipped the immediate duplicate.
- The second message repeated the same pattern: one `ratio-unavailable` skip, one measured failure, one cooldown skip.

Source inspection maps the failure to current implementation:

- `src/runtime/hooks.ts:109-113` passes the plugin client into `TokenCompactionTracker`.
- `src/runtime/hooks.ts:194-196` records token telemetry and then calls `maybeSummarize`.
- `src/runtime/token-compaction.ts:238-253` extracts `this.options.client?.session.summarize` into a local function and then calls it. The real provider error is consistent with the SDK method requiring its client binding.
- `src/runtime/token-compaction.ts:261-275` records the failed attempt, which is why evidence exists instead of silently passing.

Interpretation:

- PH evidence was present in both conditions.
- The ON condition reached measured ratios above the forced low threshold.
- Host summarize did not trigger successfully; therefore no post-summarize provider movement can be interpreted.
- Cache read was `0` in both conditions, so no cacheRead reduction is observable in this scenario.
- The control/ON aggregate totals are not a valid savings comparison because the ON run failed before compaction and the model step behavior differed.

Verdict: keep compaction default-off and defer effectiveness claims. The next smallest implementation fix is to call/bind `client.session.summarize` through the SDK client object, then rerun this real-provider probe. No token-saving claim is supported.

## R2 Binding Fix Follow-up

Fix scope: this follow-up change.

Follow-up evidence: `.persona/evidence/r2-compaction-binding-fix-probe-2026-06-30T19-14-14-097Z.json`.

Raw logs: `.persona/evidence/r2-compaction-binding-fix-probe-2026-06-30T19-14-14-097Z-raw/`.

Metadata note: the ignored follow-up evidence file preserves the original run metadata and still records `head: db03653`. This tracked report is the correction record: the follow-up behavior and report interpretation apply to `75c7f38`.

Behavior fixed:

- `TokenCompactionTracker` now calls `session.summarize(request)` through the owning session object instead of extracting the method into an unbound local function.
- A focused regression test uses a `this`-dependent fake session so an unbound call fails.
- A built hook smoke imported compiled `createPhase0Hooks`, used the same `this`-dependent fake session, and observed one summarize call plus compaction evidence `status: triggered`.

Provider rerun:

| Condition | Status | Cache read | Input | Reasoning | Total | Compaction evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Control/default-off | step1 timed out (`124`), step2 skipped | 0 | 64,017 | 1,465 | 65,727 | No compaction file, as expected. |
| ON/compaction enabled | step1 timed out (`124`), step2 skipped | 0 | 7,437 | 374 | 7,811 | Only initial `ratio-unavailable`; no measured trigger. |
| ON smaller no-tools smoke | timed out (`124`) | 0 | 7,275 | 1,522 | 8,797 | Only initial `ratio-unavailable`; no measured trigger. |

Interpretation:

- The binding defect is fixed at the runtime surface and no longer reproduces in the built hook smoke.
- The real-provider rerun did not reach a successful measured compaction trigger, so it cannot measure cacheRead/total movement.
- Compaction remains default-off/deferred. No token-saving claim is supported.

## R2 Stable Scenario Probe

Summary evidence: `.persona/evidence/r2-stable-compaction-scenario-2026-07-01T02-25-27-177Z.json`.

Raw logs: `.persona/evidence/r2-stable-compaction-scenario-2026-07-01T02-25-27-177Z-raw/`.

Method:

- Source: local/current package from HEAD `b7b5a20`; registry `@next` was not used.
- Mode: safe isolated non-pure OpenCode mode, with isolated `HOME` and `XDG_*`, workspace PH plugin only, no `.codegraph`, and OMO/codegraph environment disabled.
- Model: `opencode/north-mini-code-free`.
- Agent: a custom primary `probe` agent that instructed direct short replies and appended wildcard tool deny, so this scenario did not depend on file reads or application generation.
- Compaction config: `enforce.compaction.enabled=true`, threshold `0.000001`, cooldown `3600000`.
- Session: `ses_0e4841b6affeZcPq15tfSCRc8o`; step 2 and step 3 reused this session via `opencode run --session`.

Measured sequence:

| Step | Command intent | Exit status | Provider telemetry | Tool events |
| --- | --- | ---: | --- | ---: |
| step1 | `Reply exactly: STEP_ONE_OK` | 124 | Five `step_finish` events were emitted, including the initial `STEP_ONE_OK` response and later OpenCode compaction-agent responses. The session token evidence aggregate ended at cacheRead `0`, input `2,199`, reasoning `4,804`, total `7,003`, ratio `0.00858984375`. | 0 |
| step2 | `Reply exactly: STEP_TWO_OK` in the same session | 1 | No `step_finish` event. stderr reported provider `AI_APICallError` after OpenCode routed the continuation through its `compaction` agent. | 0 |
| step3 | `Reply exactly: STEP_THREE_OK` in the same session | 1 | No `step_finish` event. stderr again reported provider `AI_APICallError` through the `compaction` agent. | 0 |

Compaction evidence:

- The first event recorded a `ratio-unavailable` skip before any token aggregate existed.
- After token evidence was available, compaction recorded `status: triggered` with request `{ providerID: "opencode", modelID: "north-mini-code-free", session id, directory }`.
- Later continuation in a new `opencode run --session` process recorded another `status: triggered` for the same aggregate. This shows the current cooldown is process-local and does not suppress repeated triggers across separate OpenCode CLI processes.
- No post-trigger provider telemetry was observed after either trigger.

Interpretation:

- Same-session continuation was possible.
- The summarize binding fix allowed the compaction path to reach `status: triggered` in a real provider scenario.
- The scenario still did not produce post-summarize provider telemetry: subsequent same-session prompts failed before `step_finish`, after OpenCode routed through its internal `compaction` agent.
- Cache read stayed `0`; total/cache movement after summarize is therefore unmeasured.

Verdict: `measurement-scenario-blocked`. Keep compaction default-off and defer effectiveness claims. The next smallest investigation is OpenCode summarize/compaction lifecycle behavior in a long-lived or otherwise stable session, plus whether PH cooldown needs durable evidence-backed suppression across separate `opencode run --session` processes. No token-saving claim is supported.

## OpenCode Summarize Lifecycle Follow-up

Lifecycle evidence: `.persona/evidence/opencode-compaction-lifecycle-2026-07-01T02-35-42-395Z.json`.

Source-backed findings:

- Local SDK types show PH is using the exposed summarize shape: `node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts` exposes `session.summarize`, and `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` defines body `{ providerID, modelID }`, path `{ id }`, and optional query `{ directory }`.
- Local plugin types expose compaction customization hooks, including `experimental.session.compacting` and `experimental.compaction.autocontinue`, but no OpenCode CLI help or local type surface found a clear API to wait for summarize completion or clear the internal compaction-agent state.
- Stable scenario raw logs show OpenCode `agent=compaction` streams after the initial prompt and on later `opencode run --session` calls. Step 2 and step 3 then failed with provider `AI_APICallError` before `step_finish`, so no post-trigger telemetry was available.

PH-owned fix:

- `TokenCompactionTracker` previously kept cooldown only in an in-memory map. Separate `opencode run --session` processes therefore had fresh tracker instances and could call `session.summarize` again despite recent compaction evidence.
- The tracker now consults `.persona/evidence/compaction/<session>.json` before calling summarize. Recent `triggered` or `failed` attempts within `cooldownMs` are treated as `cooldown-active` across processes.
- A focused regression test creates a fresh hook/tracker instance in the same project/session and verifies the second instance skips summarize while persisted evidence cooldown is active.

Interpretation:

- This does not fix OpenCode's internal compaction-agent provider failure or prove compaction effectiveness.
- It does stop PH from repeatedly triggering summarize against the same session during the configured cooldown window.
- Compaction remains default-off/deferred. No token-saving claim is supported.

## Lever Decision Table

| Lever | Current status | Measured before/after | Decision |
| --- | --- | --- | --- |
| Token telemetry | Implemented and externally verified | Writes provider token evidence in safe isolated non-pure mode. | Keep as measurement infrastructure. |
| Proactive compaction | Default-off mechanics implemented and externally verified; summarize binding fixed; persisted evidence cooldown now suppresses repeat triggers across CLI processes | Built hook smoke reaches `triggered`; stable same-session provider scenario also reached `triggered`, but later provider responses failed before post-summarize `step_finish` telemetry. | Defer/default-off; needs a stable post-trigger provider telemetry scenario before effectiveness can be judged. |
| Hashline edit routing | Feasibility no-go for hard routing | No provider-token experiment run because SDK payload cannot enforce native write routing. | Defer/no-go for enforced route. |

## Boundaries

- No broad token-saving or provider-token saving claim.
- No PH product-efficacy claim.
- No OMO parity claim.
- No codegraph or OMO integration/replacement claim.
- No generated app quality certification.
- No broad reliability or closure guarantee.
- Closure and ast-grep conformance gates remain authoritative and unchanged.

## Recommended Next Step

Do not run another broad effectiveness loop yet. The PH-owned repeat-trigger issue is fixed; the remaining blocker is OpenCode's internal compaction-agent lifecycle/provider failure before post-trigger telemetry. Keep `enforce.compaction.enabled` default-off unless a later real measurement shows favorable provider telemetry movement.
