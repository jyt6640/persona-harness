# Multi-Agent Relay Trial Status

Status: Stage 13 partial; relay static guidance reached the main-session relay
command, but did not produce observed OpenCode subagent delegation.

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
