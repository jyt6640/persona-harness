# Multi-Agent Relay Design

Status: R1 preview implemented. The relay is default-off, read-only, and non-autonomous.

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

## R1 Relay Preview

Subagent promotion is opt-in. The implemented config surface is:

```jsonc
{
  "multiAgent": {
    "enabled": false,
    "roles": ["test-writer", "jaeki", "roach"],
    "models": {}
  }
}
```

`ph bootstrap backend --multi-agent-preview` turns this on for the project and updates `.opencode/opencode.json` with top-level `agent` entries for exactly `test-writer`, `jaeki`, and `roach`, each with `mode: "subagent"`. It preserves the existing OpenCode config and does not use `.opencode/agent/*.md`.

First 3-role preview order:

- `test-writer`: tester. Owns focused failing tests, verification commands, and structured evidence expectations.
- `jaeki`: implementer. Takes the accepted plan/current ticket and writes production code/tests plus implementation report evidence.
- `roach`: reviewer. Owns review-report pressure, closure blocker review, and regression risk notes.

The `test-writer` prompt points to canonical PH test guidance instead of embedding a separate TDD essay: `.persona/rules/backend/spring-test.md` section `PH Multi-Agent Relay`, the current ticket/scenario contract rule, and the detailed shared reference `packages/shared-skills/skills/programming/references/java/testing.md` section `Persona Harness relay contract`. Skills Prompting owns that shared guidance; R1 only consumes the stable PH rule/reference paths and the boundary that `test-writer` must not implement product code or weaken/delete tests.

Reserved but not workerized at first:

- `blackbear`: remains the plan artifact/requirements decomposition role.
- `Charles`: remains coordinator state and closure handoff language.

Core invariant:

- PH closure/workflow state remains the orchestrator/gate.
- OpenCode subagents are workers.
- `workflow closure next`, `workflow check`, `workflow archive`, and `workflow finish implement` remain the authoritative state/gate surfaces.

Implemented read-only surfaces:

- `ph workflow relay status --json`
- `ph workflow relay next --json`

These commands do not call OpenCode and do not dispatch native subtasks. They read the current workflow ticket and closure blocker, then emit a scoped handoff object with `enabled`, `currentTicket`, `currentRole`, `roleCompletionState`, `nextRole`, `roleOrder`, `scopedInputFiles`, `promptBlock`, `promptLines`, `requiredOutputArtifact`, `requiredArtifact`, `gateCommand`, and blocker fields.

R1 role artifacts live under `.persona/workflow/work/<ticket>/roles/`:

- `.persona/workflow/work/<ticket>/roles/test-writer.md`
- `.persona/workflow/work/<ticket>/roles/jaeki.md`
- `.persona/workflow/work/<ticket>/roles/roach.md`

Missing artifacts block relay progression with preview-only blockers such as `role-test-artifact-missing`, `role-implementation-artifact-missing`, and `role-review-artifact-missing`. These are relay handoff blockers only; they do not weaken or replace workflow closure/check/archive/finish gates.

## Token/Cost Guardrails

- Scoped context only: each handoff should include current ticket id, blocker id, source path, and exact expected artifact, not the full project history.
- Model tiering: implementer/reviewer/tester may use different model levels, but R1 should keep model choice config-driven and default conservative.
- Gate-before-next-role: do not start reviewer until implementation artifacts and verification evidence exist; do not start archive/finish until closure blockers clear.
- Evidence logging: each role handoff should write structured PH evidence with role, ticket, blocker, source files, command/evidence refs, and result.
- Repetition cap: if the same closure blocker repeats, stop and surface the blocker instead of spawning another worker.
- No automatic report fabrication: workers may fill reports, but PH must not invent evidence or mark substantive reports complete without content.

## R1 Blockers / Unknowns

- `.opencode/agent/*.md` support is not source-proven in the installed SDK/plugin artifacts measured here, so R1 does not use it.
- Agent-specific system constitution is not source-proven through `experimental.chat.system.transform`; R1 needs either a `chat.message` session-agent cache or a future hook input with `agent`.
- Native subtask dispatch should be tested with a no-model/local probe before productizing; R0 did not run OpenCode or models.
- Permission/write-deny is unrelated to relay and remains constrained by the current SDK payload limitations.
- R1 does not promise token savings, OMO parity, autonomous completion, or a full agent loop.

## R3 Native Subtask Probe

No-model probe result: keep native dispatch deferred. `opencode agent list --pure` recognizes the R1 `.opencode/opencode.json` top-level `agent` map and lists `test-writer`, `jaeki`, and `roach` as subagents, so the agent definition surface is usable without a model run. The available no-model CLI help surfaces expose `opencode run --agent`, `opencode agent list`, `opencode agent create`, `opencode serve`, and `opencode attach`, but not a standalone no-model subtask submission command.

The SDK has typed native delegation shapes: `SubtaskPartInput` (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:1263-1269`) and `SessionPromptData` / `SessionPromptAsyncData` parts that accept subtask inputs (`node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2244-2258`, `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:2329-2342`). The callable client methods are `session.prompt` and `session.promptAsync`, both documented as creating and sending a new message to a session (`node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts:172-182`). That means a real dispatch proof requires an active OpenCode session/server and would submit a message, so PH should not implement native subtask dispatch from the CLI yet.

Recommended next slice: tighten deterministic relay role gates and artifacts inside PH's read-only/handoff surfaces, while keeping closure/check/archive/finish authoritative. Native dispatch should wait until a safe no-model API probe or an explicitly approved model/session probe proves the behavior.

## Suggested R3b Slice

1. Keep PH relay JSON/handoff-only until native dispatch has an approved session/model probe.
2. Tighten deterministic role artifact gates and coordinator status so role progression is explicit and auditable.
3. If dispatch is later added, keep it config-gated, bounded by role artifact checkpoints, and stopped by closure blockers.
4. Keep finish/archive/check strict. Relay workers may help clear blockers; they do not bypass them.
