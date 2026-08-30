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

`philosophy-refinement` is explicit-only: it begins only when the user asks to
change, review, or persist a reusable philosophy. A direct implementation
request, design criticism, or one-off code preference stays on its normal route.

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

When a compact route selects a Persona skill, it also requires one short
user-visible notice at the beginning of the next assistant response. The notice
names the selected skill, whether it was automatic or explicit, and the bounded
selection reason in the user's language. It is a conversational status line,
not a claim that the full skill body was injected or a host-native UI toast.

## Product Discovery

The product deep interview asks one product question at a time and gives a
recommendation plus its tradeoff. A user may answer, request a recommendation,
defer, or stop. After the facts are complete, it renders a brief and requires
an explicit `approve` before technical intake.

While an interview is active, a natural-language request not to interview, a
whole-task discovery defer, or a workflow feedback/dogfooding task switch ends
that interview before the message can become an answer. The session remains
suppressed until the user explicitly sends `/persona deep-interview`; another
ambiguous product request does not restart it. A bare `defer` remains a
per-topic answer. A clarification request holds the current topic and asks the
host to explain only that question in plain language. At the final approval
boundary only, an English token within one edit of `approve` is accepted once;
it cannot advance an unresolved topic.

The compact `[Persona Harness Skill Route]` marker is emitted only when
`deep-interview` is actually selected. A stop or clarification carries the
`[Persona Harness Product Interview]` control marker but is not a new skill
activation or a claim that the complete skill body ran.

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
When a user asks what the current slot means or says that they do not
understand it, that is a clarification request rather than an answer. The hold
explains only the current slot in plain language and keeps it unresolved; it
does not advance to another OAuth decision.
An active hold also recognizes a bounded request to stop the interview, such as
`아니 지금 필요없는 인터뷰 하지마`; it clears the session without recording a
decision or asking the next slot. A later unrelated request follows its normal
route. A clear non-auth workflow diagnostic or dogfooding request also ends an
unapproved hold instead of being stored as a design answer; arbitrary unrelated
text does not implicitly cancel it.

After approval, later authentication or security work in the same OpenCode
session reuses the accepted handoff without reopening the seven slots. Unrelated
non-auth messages are not intercepted, and a fresh session still starts with a
new unresolved hold. The approval command remains standalone; an English token
within one edit of `approve` is accepted for obvious typing mistakes such as
`approver`, while sentences and unrelated lookalikes remain blocked.

## Host Boundary

A host adapter may show a compact route to one catalog entry. It advises and
routes only: it does not inject the full skill body or catalog into every turn,
run commands, or automatically create or advance workflow state. Existing `ph`
workflow commands remain separate user-selected product operations; the
shared-skill adapter does not grant them authority.

On OpenCode, the plugin config hook also registers the package's bundled
`packages/shared-skills/skills` directory with OpenCode's native skill loader
through the current OpenCode 1.x `skills.paths` setting. If a compatible newer
host supplies a `skills` source array instead, that array is preserved and
extended. This makes the catalog discoverable without writing a
machine-specific package path into the consumer config. Existing valid skill
sources are retained; an incompatible setting is left untouched. Registration
does not activate a skill, inject all skill bodies, or change the routing and
workflow authority rules above.

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
