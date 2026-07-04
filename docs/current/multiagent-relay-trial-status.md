# Role Checklist Relay Trial Status

Status: Stage 13 partial; relay static guidance reached the main-session relay
command, but did not produce observed OpenCode subagent delegation. Current
product direction is a main-session role checklist rail with optional
host-dependent subagent use. `--multi-agent-preview` and `multiAgent` remain
compatibility flag/config names for this preview.

## Stage 13 Reduced Proxy Trial

- Archive: `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/multiagent-relay-proxy-trial-ralph-off-20260703T092730Z`
- Source package: local-current tarball from `persona-harness@0.5.0`, package shasum `6cf87a0bb149bc6a8304dba632d83f5066118cb6`
- Trial type: n=1 usability proxy, not A/B and not statistical evidence.
- Reduced path: `ralphLoop` OFF because Stage 12 did not exercise/validate ralph-loop ON behavior.
- Setup: `ph bootstrap backend --multi-agent-preview`, static relay guidance present in `AGENTS.md`, OpenCode subagents configured for `test-writer`, `implementer`, and `reviewer`.
- Assertions: `multiAgent.enabled=true`, `features.runtimeInjection=false`, `enforce.ralphLoop.enabled=false`.

Observed items:

- Main session called `npx ph workflow relay next --json`: yes, 2 observed command uses.
- Role subagents invoked: no OpenCode task/agent subagent invocation observed.
- Role artifacts created: one `test-writer` artifact at `.persona/workflow/work/req-1/roles/test-writer.md`.
- Closure/finish gate connected: yes, but final finish remained blocked.
- Role-boundary heuristic evidence: no runtime evidence files; report-only finding said the `test-writer` artifact lacked required failing/verification test evidence.
- Session injection/utterance skip evidence: none observed.
- Breakpoint: `relay-called-but-no-subagent-invocation-observed`.
- OpenCode result: timed out at the 600000 ms cap; provider token telemetry was captured as a snapshot only.

Scorecard outputs:

- `scorecard.json`
- `SCORECARD-RESULT.md`

## Judgment

Stage 13 is PARTIAL. The reduced trial shows that static relay guidance can be
noticed enough for the main session to run the relay command and create an
initial role artifact, but it did not demonstrate end-to-end
`test-writer -> implementer -> reviewer` delegation through OpenCode subagents.

This result is a usability breakpoint record only. It does not support
multi-agent reliability, product efficacy, app quality, or default changes.

## Relay PromptBlock Subagent Retry

Status: PARTIAL negative signal.

- Archive: `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/relay-promptblock-subagent-retry-20260703T103717Z`
- Source package: local-current `persona-harness@0.6.0-rc.1` tarball built
  after the promptBlock wording change; package shasum
  `cc00d7dc4c9b6e179b75ea06cc567458709a1827`.
- Trial type: n=1 usability proxy, not A/B and not statistical evidence.
- Setup: `ph bootstrap backend --multi-agent-preview --force`; OpenCode agents
  existed for `test-writer`, `implementer`, and `reviewer`; `runtimeInjection`
  and `ralphLoop` were both false.
- OpenCode result: clean exit 0 in 42581 ms using `openai/gpt-5.4-mini-fast`.

Observed items:

- Main session called `npx ph workflow relay next --json`: yes.
- PromptBlock contained the explicit `test-writer` subagent/task-tool
  instruction: yes.
- Role subagents invoked: no OpenCode task/agent/subagent tool invocation
  observed.
- Role artifacts created: none.
- Closure/finish gate connected: no.
- Breakpoint:
  `relay-called-and-promptBlock-read-but-no-subagent-invocation-observed`.

Interpretation: promptBlock wording alone did not overcome the Stage 13
breakpoint in this fixture. Unless a later approved track funds stronger
orchestration or hook work, relay should be framed as a main-session role
checklist rail rather than reliable OpenCode subagent orchestration. Caveat:
the probe prompt also asked the run to stop after the gate result was clear,
which may have reinforced the observed stop behavior; the task scope allowed
exactly one cheap retry, so no second run was performed.

## Current Product Direction

Status: accepted reframe.

Role Checklist Relay preview is now described as a main-session checklist rail that
steps through role lenses: `test-writer`, `implementer`, and `reviewer`.
`workflow relay next --json` preserves the same role order, required artifact
paths, and closure/check/archive/finish gates.

When a host exposes subagent/task invocation, PH promptBlocks may ask the host
to invoke the current role subagent. That path is optional and host-dependent:
PH does not guarantee, enforce, or certify OpenCode subagent invocation. If
subagent invocation is unavailable or not taken, the main session should
complete the current role checklist and record that limitation in the role
artifact.

This reframe is based on the Stage 13 proxy trial and the promptBlock cheap
retry, both of which observed relay command/prompt behavior but no reliable
OpenCode task/subagent invocation. It does not remove the `--multi-agent-preview`
surface, the `multiAgent` config key, or the OpenCode subagent config entries;
it narrows their wording and decision status.

## P2 OpenCode Subagent Capability Probe

Status: direct invocation capability observed; relay orchestration remains
unproven.

- Archive: `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/opencode-subagent-capability-probe-20260704T033945Z`
- Probe type: n=1 direct capability probe, not A/B and not statistical evidence.
- Setup: disposable workspace with `.opencode/opencode.json` defining
  `test-writer`, `implementer`, and `reviewer` as `mode: "subagent"` agents.
- OpenCode: `opencode@1.17.7`; run used `opencode run --pure --format json`
  with `openai/gpt-5.4-mini-fast`.

Observed items:

- OpenCode exposed a model-visible tool named `task`.
- The model called `task` with `subagent_type: "test-writer"`.
- The task output returned child session `ses_0d4c9ecdeffeMNp0DgLauJCLAF`
  with `SUBAGENT_PROBE_OK`.
- Sanitized `opencode export` for the child session reported
  `parentID: "ses_0d4ca02d5ffeNMEQK1IprlX2c1"` and `agent: "test-writer"`.

Interpretation: the Stage 13 and promptBlock-retry failures are not explained
by total host/tool absence. In this environment, OpenCode can expose and execute
a configured subagent through the `task` tool when the prompt is a direct
capability request. The unresolved product question is narrower: PH relay
promptBlocks have not yet reliably caused role-stage subagent invocation during
the checklist workflow. Until a later approved trial observes role-flow
invocation across meaningful relay stages, the product direction remains a
main-session role checklist rail with optional host-dependent subagent use.

This probe does not support reliable automatic OpenCode subagent orchestration,
production-ready delegation, default changes, product efficacy, app quality, or
token/cost claims.

## Stage 19 Reconciliation

Status: no additional probe needed for the direct capability question.

Stage 19 asked whether OpenCode exposes a usable subagent/task invocation
capability, and whether a direct n=1 invocation path must be retried. The
accepted P2 archive above satisfies that direct-call requirement: the model saw
and called a `task` tool with `subagent_type: "test-writer"`, OpenCode created a
child session, and the child returned `SUBAGENT_PROBE_OK`.

Decision: automatic orchestration is not blocked by total host absence, but PH
relay-path orchestration remains unproven. Stage 13 and the promptBlock retry
still did not observe task/subagent invocation through the Role Checklist Relay
role-stage flow. Therefore the current product framing remains a main-session
role checklist rail with optional host-dependent subagent use.

Future automatic-orchestration work should require a separately approved
relay-path trial that observes role-flow task invocation during meaningful
`test-writer -> implementer -> reviewer` progression. A direct capability prompt
alone is not enough to claim reliable automatic subagent orchestration or
production-ready delegation.

## Role-Boundary Caveat

`workflow role-boundary` heuristic write observation is report-only. It uses
time-window, path, and current-role context and cannot deterministically identify
the actor behind a write.

A role-boundary finding may come from the main session, the current role
checklist pass, or an unrelated subagent/session. It must not be treated as
deterministic role enforcement, blocked-write evidence, closure-blocker
evidence, or proof of a wrong actor.

Block/enforcement mode remains unavailable until stable per-session role
identity exists. The current relay direction is a main-session checklist rail
with optional host-dependent subagent use, not deterministic actor attribution.

## Stage 14 Implication

If Stage 14 proceeds, multi-agent preview wording should remain conservative:
the current evidence supports a reportable static relay guidance path, not
reliable automatic role delegation. Stage 14 should avoid wording that implies
production-ready OpenCode subagent orchestration unless a later trial observes
2+ role stages with actual subagent invocation and closure progress.

## Boundaries

- n=1 usability proxy trial only.
- No token-saving, provider-token saving, product-efficacy, navigation-benefit,
  app-quality, full-TDD, broad reliability, closure guarantee, generated-app
  certification, deterministic role enforcement, autonomous completion,
  automatic downgrade, or automatic removal claim is made.
- `ralphLoop` remains default-off and was not enabled in this trial.
