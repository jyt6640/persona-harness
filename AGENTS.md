# Persona Harness Development

## Repository Context

This repository builds the Persona Harness TypeScript CLI, OpenCode runtime,
portable host adapters, and shared engineering skills. The delivered backend
workflow targets Java/Spring; that consumer target is not this source tree's
implementation language. Read `.persona/project-profile.jsonc` when present.
If an initialized consumer profile conflicts with the source tree, explain the
conflict and use the actual files being changed to scope source maintenance.
Do not bootstrap a consumer workflow merely to work on this package.

- Keep the canonical engineering philosophy and approved project decisions
  useful to the task. Preserve user-owned configuration and generated-adapter
  ownership boundaries.
- Inspect named source files and nearby tests. Do not use dependencies,
  `.persona/evidence`, or generated `dist` as implementation context.
- Use the existing Node/npm/TypeScript/Vitest toolchain. The canonical publisher
  version is in `package.json`; do not switch package managers during a fix.

## Working Agreements

- Continue an authorized task through implementation, verification, and report.
  Reuse permission given for the same scope. Ask only about a material unresolved
  choice or a next action outside that authorization.
- Treat side questions and corrections as steering. Explain confusion before
  asking another question. Stop an interview immediately when requested.
- Skill guidance never overrides the user's task or grants new permission.
  Announce the selected skill once. Name an exact conflicting instruction if it
  blocks progress.
- Default to the main session. Use subagents only with the user's permission;
  when permitted for this repository, use Luna Max only.
- Keep edits scoped. Preserve unrelated work and use an isolated worktree when
  the shared checkout is dirty.

## Verification

- During implementation, use `npx vitest run <affected-tests>` and
  `npm run typecheck` as appropriate.
- After changing shared skills, build and generate host plugins with
  `npm run generate:host-plugins`, then validate the generated distribution.
- Public behavior changes need behavioral regressions. Prompt prose is reviewed
  directly; sentence snapshots do not prove model behavior.
- Use one heavyweight build/test/package job at a time. Expand checks for shared
  behavior and the required release gates; repeat only after relevant changes
  or failed evidence.
- Record actual commands and outcomes. Synthetic fixtures, installed-package
  checks, and live host observations prove different things.

## Delivery

Follow `docs/current/hq-orchestration/control-contract.json` and `protocol.md`.
Record the issue's named start predicate and exact candidate before conditional
acceptance and hosted gates. Existing user authorization applies; do not invent
a new approval checkpoint for ordinary in-scope work.

- Use purpose-first `feat/`, `fix/`, `docs/`, `ci/`, `test/`, `security/`, or
  `perf/` branches. Do not create active `codex/` branches.
- Never push directly to protected main, force a release tag, bypass required CI,
  weaken authority verification, or reuse an external one-shot as a debugger.
- A closure-ready PR uses `Closes #...`; partial dependencies use `Relates to`.
- For package-visible changes, check source, installed package, generated assets,
  version metadata, and release documentation before freeze.
- If the user requests main-session-only work, perform review locally and state
  that it is owner review, not independent human or host evidence.

## Code Review Rules

Prioritize incorrect authorization, stale decisions, repeated interviews,
configuration loss, source fallback, path/ownership failures, and false
completion claims. Do not promote unobserved host behavior to supported behavior
because a manifest or a unit test is green.
