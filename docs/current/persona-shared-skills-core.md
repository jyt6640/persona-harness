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

## Automatic Activation

The portable router selects at most one compact catalog reference for the
current turn. It applies this order: an explicit `/persona <skill-id>` command,
then a clear direct debug, review, refactor, Git, or implementation request,
then an ambiguous product request. An explicit command never falls back to a
different skill when it is malformed or unavailable.

An ambiguous new-product request starts `deep-interview` with one adaptive
question, recommendation, and tradeoff. An ambiguous brownfield request starts
the same skill in code-first discovery mode: inspect the relevant existing code
before asking for facts the code can establish. `skip`, `defer`, and `stop`
requests suppress a new interview start. Clear direct work bypasses discovery.

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

## Host Boundary

A host adapter may show a compact route to one catalog entry. It advises and
routes only: it does not load the full skill body or catalog, run commands, or
automatically create or advance workflow state. Existing `ph` workflow commands
remain separate user-selected product operations; the shared-skill adapter does
not grant them authority.

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
