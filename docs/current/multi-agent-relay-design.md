# Role Checklist Relay Design

Status: R1 preview implemented; current accepted direction is main-session role
checklist rail with optional host-dependent subagent use. The relay is
default-off, read-only, and non-autonomous.

## Scope

This note measures the current OpenCode native agent/subagent surfaces available to Persona Harness and sketches a small PH relay preview. It does not implement autonomous workers, OMO parity, a full agent loop, eval behavior, release behavior, or model execution.

PH role names are reserved workflow roles today, not autonomous workers yet. The current `ph workflow roles` artifact explicitly says it is a workflow contract for a single AI agent and does not spawn subagents (`src/cli/workflow-roles.ts:15-17`, `src/cli/workflow-roles.ts:36-42`). The blackbear plan artifact also states that plan output is not autonomous subagent execution (`src/cli/plan.ts:190-197`).

## R0 Findings

### 1. Agent Definition Shape

Source-backed shape:

- OpenCode SDK exposes `AgentConfig` with `model`, `prompt`, `tools`, `description`, `mode`, `maxSteps`, and `permission` fields (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:835-875`).
- `mode` is explicitly `"subagent" | "primary" | "all"` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:848`).
- OpenCode config exposes an `agent` object keyed by agent name (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:1110-1118`).
- Runtime-listed agents include `name`, `description`, `mode`, `permission`, optional `model`, optional `prompt`, `tools`, and `options` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:1399-1424`).
- `App.agents` lists available agents from `/agent` (`node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts:261-263`, `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2884-2896`).

Current PH state:

- `npx ph init` writes `.opencode/opencode.json`, but only merges the Persona Harness plugin path into the `plugin` field (`src/cli/init.ts:127-137`).
- Init tests assert that generated `.opencode/opencode.json` contains `plugin: [<dist/index.js>]`, not an `agent` map (`tests/persona-harness-init.test.ts:63-69`).

R0 conclusion:

- The source-backed native shape to target first is `.opencode/opencode.json` with a top-level `agent` map.
- The current installed SDK/plugin artifacts did not expose source/type evidence for `.opencode/agent/*.md` loading. R1 should not depend on markdown agent files unless a later OpenCode version or direct product doc/source proves that shape.

### 2. Delegation Surface

Source-backed surfaces:

- `SessionPromptData.body` accepts `agent?: string`, `model?: { providerID, modelID }`, `system?: string`, `tools?: { [key]: boolean }`, and `parts` that include `SubtaskPartInput` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2244-2258`).
- `SessionPromptAsyncData.body` has the same `agent`, `model`, `system`, `tools`, and `parts` shape for async prompt submission (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2329-2342`).
- `SubtaskPartInput` has `{ type: "subtask", prompt, description, agent }` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:1263-1269`).
- `Command` supports `agent`, `model`, `template`, and `subtask?: boolean` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:1270-1277`).
- `SessionCommandData.body` can carry `agent`, `model`, `arguments`, and `command` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2373-2380`).

R0 conclusion:

- Native delegation appears to be an OpenCode prompt/command surface, not a PH-specific tool call.
- A PH R1 relay can safely generate scoped handoff prompt content and, if using the plugin client, submit a native subtask part with an explicit `agent`.
- If PH is only emitting CLI text for a human/model to copy, it should not invent an undocumented syntax. It should phrase the handoff as scoped task text and leave native subtask dispatch to OpenCode surfaces that are proven in source.

### 3. PH Hook Visibility

Source-backed hook visibility:

- `chat.message` input includes `sessionID`, optional `agent`, optional `model`, optional `messageID`, and optional `variant` (`node_modules/@opencode-ai/plugin/dist/index.d.ts:187-199`).
- `chat.params` and `chat.headers` include `agent` and `model` (`node_modules/@opencode-ai/plugin/dist/index.d.ts:203-224`).
- `experimental.chat.system.transform` input includes `sessionID?` and `model`, but no `agent` field (`node_modules/@opencode-ai/plugin/dist/index.d.ts:265-270`).
- `experimental.text.complete` includes `sessionID`, `messageID`, and `partID`, but no `agent` field in the visible hook input (`node_modules/@opencode-ai/plugin/dist/index.d.ts:301-306`).
- PH currently wires `experimental.chat.messages.transform`, `experimental.chat.system.transform`, `event`, tool hooks, and text completion in `createPhase0Hooks` (`src/runtime/hooks.ts:179-299`).
- PH's current system constitution hook ignores the transform input and receives no active agent in that hook (`src/runtime/hooks.ts:277-283`).

R0 conclusion:

- PH can observe active agent in some hooks such as `chat.message`, `chat.params`, and `chat.headers`, but the current PH hook implementation does not register those hooks.
- PH cannot make `experimental.chat.system.transform` agent-specific from its typed input alone because that hook exposes `sessionID?` and `model`, not `agent`.
- R1 should avoid agent-specific system constitution until PH either uses `chat.message` to record session/agent state or OpenCode exposes `agent` directly to system transform.

## R1 Role Checklist Relay Preview

Relay role checklist preview is opt-in. The implemented config surface is:

```jsonc
{
  "multiAgent": {
    "enabled": false,
    "roles": ["test-writer", "implementer", "reviewer"],
    "models": {}
  }
}
```

`ph bootstrap backend --multi-agent-preview` turns this on for the project and updates `.opencode/opencode.json` with top-level `agent` entries for exactly `test-writer`, `implementer`, and `reviewer`, each with `mode: "subagent"`. These entries are optional host capability: PH promptBlocks may ask the host to use them, but PH does not guarantee or enforce host subagent invocation. It preserves the existing OpenCode config and does not use `.opencode/agent/*.md`. Preview-era `jaeki` and `roach` agent keys are migrated to `implementer` and `reviewer` when no new key already exists.

Naming decision: `Role Checklist Relay` is the primary user-facing name.
`--multi-agent-preview` and `multiAgent` remain compatibility flag/config names
for the current prerelease line; they should not be read as a claim that PH
guarantees automatic multi-agent orchestration.

First 3-role checklist order:

- `test-writer`: tester lens. Owns focused failing tests, verification commands, and structured evidence expectations.
- `implementer`: implementation lens. Takes the accepted plan/current ticket and writes production code/tests plus implementation report evidence.
- `reviewer`: review lens. Owns review-report pressure, closure blocker review, and regression risk notes.

The `test-writer` prompt points to canonical PH test guidance instead of embedding a separate TDD essay: `.persona/rules/backend/spring-test.md` section `PH Multi-Agent Relay`, the current ticket/scenario contract rule, and the detailed shared reference `packages/shared-skills/skills/programming/references/java/testing.md` section `Persona Harness relay contract`. Skills Prompting owns that shared guidance; R1 only consumes the stable PH rule/reference paths and the boundary that `test-writer` must not implement product code or weaken/delete tests.

Reserved but not workerized at first:

- `blackbear`: remains the plan artifact/requirements decomposition role.
- `Charles`: remains coordinator state and closure handoff language.

Core invariant:

- PH closure/workflow state remains the orchestrator/gate.
- The main session can complete each current role checklist and artifact.
- OpenCode subagents are optional host-provided workers when the host chooses to invoke them.
- `workflow closure next`, `workflow check`, `workflow archive`, and `workflow finish implement` remain the authoritative state/gate surfaces.

Implemented read-only surfaces:

- `ph workflow relay status --json`
- `ph workflow relay next --json`

These commands do not call OpenCode and do not dispatch native subtasks. They read the current workflow ticket and closure blocker, then emit a scoped handoff object with `enabled`, `currentTicket`, `currentRole`, `roleCompletionState`, `nextRole`, `roleOrder`, `scopedInputFiles`, `promptBlock`, `promptLines`, `requiredOutputArtifact`, `requiredArtifact`, `gateCommand`, and blocker fields.

## Accepted Reframe After Stage 13

Stage 13 and the follow-up promptBlock retry observed that OpenCode noticed the
relay command/prompt path, but did not reliably invoke role subagents. The
current product wording therefore treats relay as a main-session checklist rail,
not automatic OpenCode subagent orchestration.

The expected path is:

1. Run `npx ph workflow relay next --json`.
2. Follow the current role lens: `test-writer`, `implementer`, or `reviewer`.
3. If the host exposes and chooses a task/subagent invocation surface, use the
   matching role subagent.
4. If subagent invocation is unavailable or not taken, complete the role
   checklist in the main session.
5. Record whether subagent invocation was used or unavailable in the role
   artifact.
6. Re-run relay/closure/check/finish gates.

This reframe does not remove the `.opencode/opencode.json` agent entries. It
does remove any product implication that PH can guarantee, enforce, or certify
native host subagent orchestration.

## Role-Boundary Heuristic Blind Spot

`workflow role-boundary` heuristic write observation is report-only. It uses
time-window, path, and current-role context; it cannot deterministically identify
the actor behind a write.

A finding may originate from the main session, the current role checklist pass,
or an unrelated subagent/session. It must not be treated as deterministic role
enforcement, blocked-write evidence, closure-blocker evidence, or proof of a
wrong actor.

Block/enforcement mode remains unavailable until stable per-session role
identity exists. This limitation is intentional: relay currently remains a
main-session checklist rail with optional host subagent use, not deterministic
write attribution or enforcement.

R1 role artifacts live under `.persona/workflow/work/<ticket>/roles/`:

- `.persona/workflow/work/<ticket>/roles/test-writer.md`
- `.persona/workflow/work/<ticket>/roles/implementer.md`
- `.persona/workflow/work/<ticket>/roles/reviewer.md`

Relay reads legacy `.persona/workflow/work/<ticket>/roles/jaeki.md` and `.persona/workflow/work/<ticket>/roles/roach.md` artifacts for compatibility, but new prompts and missing-artifact paths point to the new role names.

Missing artifacts block relay progression with preview-only blockers such as `role-test-artifact-missing`, `role-implementation-artifact-missing`, and `role-review-artifact-missing`. These are relay handoff blockers only; they do not weaken or replace workflow closure/check/archive/finish gates.

## Token/Cost Guardrails

- Scoped context only: each handoff should include current ticket id, blocker id, source path, and exact expected artifact, not the full project history.
- Model tiering: implementer/reviewer/tester may use different model levels, but R1 should keep model choice config-driven and default conservative.
- Gate-before-next-role: do not start reviewer until implementation artifacts and verification evidence exist; do not start archive/finish until closure blockers clear.
- Evidence logging: each role artifact should record role, ticket, blocker, source files, command/evidence refs, result, and whether host subagent invocation was used or unavailable.
- Repetition cap: if the same closure blocker repeats, stop and surface the blocker instead of spawning another worker.
- No automatic report fabrication: workers may fill reports, but PH must not invent evidence or mark substantive reports complete without content.

## R1 Blockers / Unknowns

- `.opencode/agent/*.md` support is not source-proven in the installed SDK/plugin artifacts measured here, so R1 does not use it.
- Agent-specific system constitution is not source-proven through `experimental.chat.system.transform`; R1 needs either a `chat.message` session-agent cache or a future hook input with `agent`.
- Native subtask dispatch should be tested with a no-model/local probe before productizing; R0 did not run OpenCode or models.
- Permission/write-deny is unrelated to relay and remains constrained by the current SDK payload limitations.
- R1 does not promise token savings, OMO parity, autonomous completion, reliable host subagent orchestration, or a full agent loop.

## R3 Native Subtask Probe

No-model probe result: keep native dispatch deferred. `opencode agent list --pure` recognized the R1 `.opencode/opencode.json` top-level `agent` map and listed the relay roles as subagents, so the agent definition surface is usable without a model run. The current public preview role names are `test-writer`, `implementer`, and `reviewer`. The available no-model CLI help surfaces expose `opencode run --agent`, `opencode agent list`, `opencode agent create`, `opencode serve`, and `opencode attach`, but not a standalone no-model subtask submission command.

The SDK has typed native delegation shapes: `SubtaskPartInput` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:1263-1269`) and `SessionPromptData` / `SessionPromptAsyncData` parts that accept subtask inputs (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2244-2258`, `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2329-2342`). The callable client methods are `session.prompt` and `session.promptAsync`, both documented as creating and sending a new message to a session (`node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts:172-182`). That means a real dispatch proof requires an active OpenCode session/server and would submit a message, so PH should not implement native subtask dispatch from the CLI yet.

Recommended next slice: tighten deterministic relay role gates and artifacts inside PH's read-only/handoff surfaces, while keeping closure/check/archive/finish authoritative. Native dispatch should wait until a safe no-model API probe or an explicitly approved model/session probe proves the behavior.

## Suggested R3b Slice

1. Keep PH relay JSON/handoff-only until native dispatch has an approved session/model probe.
2. Tighten deterministic role artifact gates and coordinator status so role progression is explicit and auditable.
3. If dispatch is later added, keep it config-gated, bounded by role artifact checkpoints, and stopped by closure blockers.
4. Keep finish/archive/check strict. Relay workers may help clear blockers; they do not bypass them.

## P2 Direct Subagent Capability Probe

Model-run capability probe result: OpenCode can expose and execute a
model-visible `task` tool for configured subagents in this environment.

The probe archive
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/opencode-subagent-capability-probe-20260704T033945Z`
used a disposable workspace with only `.opencode/opencode.json` agent entries
for `test-writer`, `implementer`, and `reviewer`. The raw JSONL recorded a
`task` tool call with `subagent_type: "test-writer"`, and sanitized
`opencode export` for the child session reported `parentID` pointing at the
main session and `agent: "test-writer"`.

This narrows the relay breakpoint: Stage 13 and the promptBlock retry did not
fail because OpenCode entirely lacked a task/subagent surface. They failed to
make the relay workflow reliably choose that surface. Current PH product
wording should therefore remain: main-session role checklist rail first,
optional host-dependent subagent use second. Any future stronger orchestration
track must prove role-flow task invocation in the actual relay path, not only a
direct capability prompt.
