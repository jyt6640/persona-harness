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

Same-topic overlap is an unresolved selection, not proof that the statements
logically contradict each other. The host first compares the concrete
obligations against the approved decision and code. If the user approves a
combined rule that preserves both obligations, propose that complete combined
candidate on the original topic and scope, then explicitly resolve it with
`supersede`. Before that resolution, only the old active rule is operative.
Afterward, Preview and target delivery use the complete combined rule and the
existing scope selectors; the earlier history events remain intact. Do not
create misleading topics, broaden the scope, or infer approval to avoid the
overlap. The deterministic store does not itself prove semantic equivalence or
understanding by the host model.

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

## Checkout-local project connection

The current source adds an explicit connection between this checkout and an
already active project rule scope:

```text
ph context scope
ph context scope bind --project <approved-key>
ph context scope unbind --project <bound-key>
```

Inspection is read-only. Bind requires an active matching project rule and
explicit user approval for this checkout. Repeating the same binding is a
no-op; a different key cannot overwrite it. Unbind removes only the matching
connection, not rules or history. The portable setup bridge accepts the same
arguments so the user need not run these commands manually.

The connection is stored under the existing personal store root at
`project-bindings/<checkout-digest>.json`. Its strict
`persona-context-checkout-binding.1` record contains only `schemaVersion`,
`checkoutDigest`, and `projectKey`. The full SHA-256 digest covers the canonical
checkout path and directory device, inode and birth time. Raw paths, rule text,
chat, and host credentials are not stored in the record. The digest identifies
related context; it is not an execution permission or cryptographic approval.

Preview and supported target hooks reuse a valid connection automatically.
Explicit Preview project selectors remain available. Other worktrees, clones,
moved directories and replacement checkouts need a new connection. A corrupt,
unsupported, symlinked or mismatched record blocks automatic Context selection
instead of silently falling back to a less specific rule. Missing connections
remain read-only and produce the existing unbound-scope diagnostic when relevant.
An explicit Context opt-out stays effective and does not read the binding from
the target hook.

Existing profile V1 documents, project configuration and user files are not
rewritten. Complete private records are published without replacing an existing
file. Per-checkout mutation locks serialize cooperating bind/unbind commands;
lock contention fails closed without unbounded waiting. An interrupted process
can leave a lock requiring explicit local recovery; it is not silently stolen.
Unsupported local filesystem operations fail closed. Worktree sharing,
automatic stale-record cleanup and recovery of manually corrupted records are
not supplied by this boundary. Task connections are separate, as described below.
This new public command/storage contract belongs to the user-approved 1.1.0
release, not a patch-only change. Source preparation does not establish registry
publication; see the [release notes](release/v1.1.0-release-notes.md).

## Session-local task connection

The user-confirmed policy is explicit same-task resume in a new session, never
automatic reuse of the checkout's last task. The portable SessionStart hook
supplies a handle derived from the configured host namespace and the hook's
`session_id`. It is not inferred from a transcript path or Codex task title.

```text
ph context task --session <handle>
ph context task --session <handle> resume --task <approved-key>
ph context task --session <handle> preview <relative-target> --json
ph context task --session <handle> end --task <bound-key>
```

Inspection and task Preview are read-only. Resume requires an active matching
task rule and explicit task selection. The same connection is a no-op; a
different active task cannot replace it. End requires the matching key and
removes only the connection. A new session, host or checkout starts unbound;
compaction using the same session identity does not change the connection.
If a host creates a new identity on resume, explicit task resume is needed.

`task-bindings/<binding-digest>.json` under the personal store uses the strict
`persona-context-task-binding.1` record with `schemaVersion`, `bindingDigest`
and `taskKey`. The digest covers the checkout identity and opaque session
handle. Raw host/session IDs, paths, rules and conversations are not persisted.
The same no-follow reader, exclusive mutation lock and complete private-record
publication used for project bindings are reused. Copying a record into another
binding's filename fails its digest check. Corruption blocks that session's
Context selection; explicit opt-out still skips binding reads in the hook.

Supported target hooks use the explicit connection. Task Preview routes the
same task key through the existing resolver, renderer and project connection.
The bridge does not guess when natural-language work changes: shared guidance
requires ending a task on completion, cancellation or switch before unrelated
work. That instruction is not deterministic host enforcement. A failed or
omitted end can leave a stale connection in the same host session, and existing
model context cannot be retracted by deleting a connection. No automatic
cleanup, session transcript parsing, or new host permission is introduced.

Local and relocated-plugin tests cover this contract. One isolated Codex
0.153.4 / Luna Max observation used explicit task resume, read-only task Preview
before editing, a durable Java regression test, and task end after verification.
Independent recompilation and 14 boundary cases passed; the profile, project
binding and config were unchanged, and no background terminals remained.
Normal one-time host approvals were required for resume/end writes. This is
bounded model evidence, not universal lifecycle enforcement or Claude evidence.
The current Codex protocol's session ID may also be shared with its subagents;
this is not a per-subagent task-isolation claim. See the official
[hook input contract](https://learn.chatgpt.com/docs/hooks#common-input-fields).

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
