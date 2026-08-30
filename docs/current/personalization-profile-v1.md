# Personalization Profile V1

Personalization Profile V1 is a local-only, append-only decision store. It is
separate from repository files and does not upload, export, or infer a user's
profile.

## Storage

The store root is selected in this order:

1. `PH_HOME`, when set;
2. `%APPDATA%/persona-harness` on Windows;
3. `$XDG_CONFIG_HOME/persona-harness` on Unix;
4. `~/.config/persona-harness` on Unix.

The store contains `profile.json`. `ph philosophy status` and `ph philosophy
init` inspect the starter profile without creating the root or the file. A
root must be absolute, regular, and free of symlink/reparse ancestors.

## Status distinction

`ph philosophy status` is read-only. Its personal-store counts and `store`
field describe only the user-scoped personalization profile. They do not say
whether a project-local convention exists.

The same JSON result includes a nonreflective `project` summary:

- `profileState` is `missing`, `draft`, `incomplete`, `invalid`, or `ready`.
- `conventionState` is `configured`, `missing`, `not-ready`, or `unsafe`.
- `injection` is the effective local `projectPhilosophyInjection` setting.
- `hostDelivery` remains `unobserved`: a local CLI status command cannot prove
  that an OpenCode host session received a system-context transform.

The status never includes the convention text, creates either store, changes
`runtimeInjection`, or enables delivery. A ready project convention can coexist
with an uninitialized personal profile.

## Versioned records

The document is `personalization-store.v1` and contains a
`personalization-profile.v1` projection plus a
`personalization-history.v1` event log. Candidate, rule, and decision records
use `personalization-candidate.v1`, `personalization-rule.v1`, and
`personalization-decision.v1` respectively. Unknown versions, fields, states,
actions, or malformed records are rejected without changing active state.

There is no implicit migration in V1. A future schema migration must be an
explicit versioned operation that preserves the old history and writes the new
document atomically.

## Lifecycle

`ph philosophy propose --stdin` accepts one structured candidate. A complete
non-conflicting candidate activates immediately. A same-topic overlapping scope
is retained as a non-operative pending candidate and cannot overwrite an active
rule. `resolve` supports `retain`, a project/task `exception`, `supersede`, and
`pending`. `rollback` appends a compensating decision; it never edits or
deletes history.

`ph philosophy refine --stdin` is the explicit Socratic refinement surface. It
accepts `personalization-refinement.v1` only when the user explicitly asks to
change, review, or persist a reusable philosophy. A direct code-change request,
design criticism, or one-off implementation preference does not start this
procedure. The host-neutral
sequence asks for the current rationale, preferred alternative, intended scope,
counterexample or side effect, and trade-offs one at a time. Incomplete,
ambiguous, unsafe, or conflicting material stays blocked or pending; it cannot
silently alter an active rule. An implementation-mistake classification reports
no profile change, while complete project/task and personal outcomes reuse the
same append-only candidate lifecycle.

Only active rules are operative. Starter recommendations are provisional, and
pending candidates do not participate in runtime injection. Project/task
exceptions are scoped records; they do not rewrite the personal rule.

## Effective resolution and selective capsules

When runtime injection is explicitly enabled, the effective profile resolver
uses the fixed precedence `product safety invariants > task decision > project
contract > personal profile > starter defaults`. It resolves one winning rule
per relevant topic; an equal-priority conflict, unknown state, unavailable
profile, malformed input, or bounded-capsule overflow blocks profile capsules
instead of guessing.

Relevance is declared by topic, scope, file role, selected skill, and available
project/task keys. Only active matching rules become compact semantic capsule
sections. The full profile and rule bodies are never injected as a profile
dump; metadata-safe evidence records only selected IDs, source layers, reasons,
and digests. `runtimeInjection` remains off by default, and this resolver does
not start or advance workflow, approval, authority, or file-role behavior.

A ready backend profile may additionally contain one safe
`philosophy.project` string. `features.projectPhilosophyInjection` defaults to
`true` and places only that compact project-local convention in the host system
context, even while broader `runtimeInjection` remains off. It is omitted for
draft, incomplete, malformed, or unsafe profile content; setting the feature to
`false` is the explicit opt-out. This narrow injection neither creates personal
profile state nor starts philosophy refinement or a workflow.

## Privacy and failure behavior

Candidates contain bounded rule metadata and non-sensitive provenance, not raw
prompts, model output, source code, credentials, or absolute project paths.
Unknown fields and unsafe text are rejected before any write. Corrupt JSON,
unsafe roots, symlinked files, invalid transitions, and interrupted/partial
state are fail-closed. Atomic private writes either publish a complete valid
document or leave the prior active projection unchanged.

The public surface is intentionally small:

```text
ph philosophy status
ph philosophy init
printf '<structured candidate JSON>' | ph philosophy propose --stdin
printf '<personalization-refinement.v1 JSON>' | ph philosophy refine --stdin
ph philosophy resolve <candidate-id> <retain|exception|supersede|pending>
ph philosophy history
ph philosophy rollback <rule-id>
```
