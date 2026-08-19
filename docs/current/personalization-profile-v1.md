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

Only active rules are operative. Starter recommendations are provisional, and
pending candidates do not participate in runtime injection. Project/task
exceptions are scoped records; they do not rewrite the personal rule.

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
ph philosophy resolve <candidate-id> <retain|exception|supersede|pending>
ph philosophy history
ph philosophy rollback <rule-id>
```
