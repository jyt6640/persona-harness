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

## Product Discovery

The product deep interview asks one product question at a time and gives a
recommendation plus its tradeoff. A user may answer, request a recommendation,
defer, or stop. After the facts are complete, it renders a brief and requires
an explicit `approve` before technical intake.

Before that approval, the route creates no plan, ticket, workflow state,
branch, issue, file, or agent. For a brownfield change, read the relevant
existing code first and ask only product intent the code cannot establish.

## Host Boundary

A host adapter may show a compact route to one catalog entry. It does not load
the full skill body, run commands, or automatically create or advance workflow
state. Existing `ph` workflow commands remain separate user-selected product
operations; the shared-skill adapter does not grant them authority.

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
