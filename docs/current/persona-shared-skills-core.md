# Persona Shared Skills Core

## Status

`packages/shared-skills/catalog.json` is the single portable Persona-owned
shared-skill contract. The catalog is shipped with the root npm package and
the runtime validates it before routing to a skill reference.

This is advisory guidance, not a workflow engine, host-agent API, ticket
system, or completion authority.

## Core And Handoffs

| Stage | Handoff |
| --- | --- |
| `deep-interview` | `technical-intake` after explicit brief approval |
| `technical-intake` | `plan` |
| `plan` | optional `ralplan`, then `tdd` |
| `tdd` | `implementation` |
| `implementation` | `review` |

`programming`, `debug`, `refactor`, and `git` are bounded supporting skills.
`frontend`, `visual-qa`, `ast-grep`, and `lsp-setup` are optional overlays:
they are selected only by an explicit user request and an available host tool.
`grill-me` is an optional, conversation-only core reference with no handoff.

## Automatic Activation

The portable router selects at most one compact catalog reference for the
current turn. It applies an explicit `/persona <skill-id>` command first, then
keeps a clear direct debug, review, refactor, Git, or implementation request on
its existing route, and protects ambiguous product discovery. An explicit
command never falls back to a different skill when it is malformed or
unavailable.

An ambiguous new-product request starts `deep-interview` with one adaptive
question, recommendation, and tradeoff. An ambiguous brownfield request starts
the same skill in code-first discovery mode: inspect the relevant existing code
before asking for facts the code can establish. `skip`, `defer`, and `stop`
requests suppress a new interview start. Clear direct work bypasses discovery.

## Decision Grill

`grill-me` can activate automatically only when the user names a concrete
decision, design, or plan and also asks to pressure-test it through assumptions,
alternatives, risks, trade-offs, or failure modes. It asks one question at a
time, gives a recommendation with its trade-off, and remains conversational.
Like every automatic route, it requires `runtimeInjection` and the workflow
domain to be enabled in the consumer configuration.
It does not replace `deep-interview` or `ralplan`: product ambiguity still uses
the interview, and an explicit high-risk delivery-plan review still uses
`ralplan`. Generic code review, debugging, refactoring, Git work, and direct
implementation retain their existing routes.

Activation is a compact reference and first safe action, not a loaded skill
body or catalog dump. The first accepted product brief hands off explicitly to
`technical-intake`, then `plan`, optional `ralplan`, `tdd`, `implementation`,
and `review`.

## Product Discovery

The product deep interview asks one product question at a time and gives a
recommendation plus its tradeoff. A user may answer, request a recommendation,
defer, or stop. After the facts are complete, it renders a brief and requires
an explicit `approve` before technical intake.

Before that approval, the route creates no plan, ticket, workflow state,
branch, issue, file, or agent. For a brownfield change, read the relevant
existing code first and ask only product intent the code cannot establish.

## Auth And Security Design Hold

An authentication or security request with unresolved architecture stays in
`design-required`. The hold asks for these decisions explicitly, one at a
time: `provider`, `domain`, `callback`, `state`, `layer`, `type-exception`,
and `global-scope`. No Spring structure, OAuth provider, callback policy,
state model, exception layer, or global response convention is inferred.

After all seven slots are explicit, the state becomes `approval-required`.
Bare approval cannot skip missing slots. Only an explicit approval after the
complete decision set releases the existing technical-intake -> plan ->
optional `ralplan` -> TDD -> implementation -> review handoff; before then,
implementation and workflow progression remain disabled.
If a slot receives conflicting explicit values, it remains unresolved; only a
dedicated `resolve <slot>: <value>` answer clears that slot. Repeated ordinary
answers never choose between conflicting values.

## Host Boundary

A host adapter may show a compact route to one catalog entry. It advises and
routes only: it does not load the full skill body or catalog, run commands, or
automatically create or advance workflow state. Existing `ph` workflow commands
remain separate user-selected product operations; the shared-skill adapter does
not grant them authority.

## Portable Host Contract

The root package exposes the versioned `persona-portable-skill-contract.1`
through `./portable-skill`. The contract derives a metadata-only capsule from
the existing catalog selection. A capsule carries the skill metadata, bounded
input/output schemas, required capabilities, handoff, and a fixed reason code;
it never carries raw prompts, model output, credentials, source content, or
absolute paths.

Codex, OpenCode, Claude Code, and Antigravity consume the same capsule through
thin adapters. A missing required capability returns the fixed
`unsupported-capability` result and does not fall back to another host's
semantics. Capability negotiation must be an explicit valid array; absent,
malformed, or unknown entries also return `unsupported-capability`. This
contract does not change selection, workflow authority, or the
`runtimeInjection` default of `false`.

## Package Boundary

The root tarball includes the catalog, each cataloged `SKILL.md`, and the
package-internal shared-skills README. The only packaged language overlay is
the Java reference directory. Legacy OMO orchestration material and legacy
`skills/workflow/**` payloads are nonoperative and excluded from the tarball.
The package-files policy test and the packed-install contract verify this
surface without falling back to repository source files.

OpenCode, AST-grep, CodeGraph, and upstream LSP integrations are optional peer
tools. A normal Persona Harness consumer install does not install or execute
their platform-specific lifecycle packages; a host that wants one supplies it
explicitly. Missing optional tools remain advisory-unavailable and never
advance workflow state.

The packaged staged-artifact Snappy decoder is pure JavaScript. Normal consumer
installation therefore does not resolve a native Snappy binary, platform
selector, or decoder lifecycle hook.

The Windows package-install surface is checked before release: the canonical
tar must have Windows-safe member names and noncolliding npm bin shims, and the
installed-package contract exercises npm's Windows bin-link behavior without a
source fallback. This does not claim Windows runtime support.

## Non-Claims

The shared-skill core does not claim that every host can invoke agents, render
UI, run AST tools, or provide an LSP. It does not automate workflow progress,
certify product quality, or replace explicit review and Finish decisions.
