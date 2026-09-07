# Approved Decision Persistence

Read this when inspecting scope connections or after the user explicitly approves
persisting a reusable decision. Reading grants no write permission.
Do not persist inferred approval, incomplete rationale, raw chat,
credentials, code, or absolute paths. Local rule storage is separate from host
trust and does not grant execution or Finish permission.

The packaged `scripts/context-setup.mjs` bridge accepts the existing `ph`
command arguments. Its path is supplied by the trusted SessionStart hook.
Outside that plugin, use the installed `ph` CLI. The user need not run or learn
these commands. `context init --enable` creates a new targeted configuration
only; it refuses every existing configuration, including an explicit opt-out.
Do not delete or overwrite a configuration to evade that refusal.

For an approved new decision, `philosophy propose --stdin` accepts this V1
shape. The content below is an example, not a decision to activate:

```json
{
  "schemaVersion": "personalization-candidate.v1",
  "candidateId": "approved-transfer-atomicity",
  "topic": "transfer-atomicity",
  "rule": "Keep transfer writes and the outbox atomic.",
  "rationale": "Prevent visible partial transfers.",
  "outcome": "Failure rolls back both writes.",
  "scope": { "kind": "personal", "key": "personal" },
  "counterexample": "Reconsider for independent data stores.",
  "tradeoffs": "One transaction spans both writes.",
  "provenance": { "kind": "user", "reference": "approved-transfer-decision" }
}
```

Use the approved scope, never a convenient substitute. Project/task scopes use
`kind: "project"` or `"task"` and the explicitly agreed key. Do not infer that
key from a directory name or store a project decision as personal to make it
apply. After a project rule is active and the user approves applying it to this
checkout, use `context scope bind --project <key>` through the same bridge.
The key identifies the agreed rule scope; users need not learn or execute this
command. `context scope` is read-only inspection. `context scope unbind
--project <key>` explicitly removes only the matching connection, not rules.
Existing connections are never silently replaced. Another worktree, clone or
moved checkout requires a new connection. Context opt-out remains effective.
Task connections are separate. The trusted SessionStart output supplies an
opaque session handle; never invent one, copy a handle from another session,
or infer a task key from a directory, branch, or the last stored task.
`context task --session <handle>` inspects this checkout/session without writes.
When the user explicitly starts or resumes the identified task, use
`context task --session <handle> resume --task <approved-key>`. This requires an
active task-scoped rule; it does not create or approve rules. A new session has
no task connection until this explicit step. Reuse the same connection while
that task continues, including compaction; do not ask for repeated approval.

Before editing, use `context task --session <handle> preview <relative-target>
--json` to resolve both the current project and task. End the matching connection
with `context task --session <handle> end --task <bound-key>` when the task is
complete, cancelled, or replaced, before unrelated work. Ending the connection
preserves the approved decision and history. Switching tasks requires ending
the old connection before resuming the new one; never silently overwrite it.
An unbound session may inspect personal/project rules but cannot automatically
apply stored task rules. Do not treat a session identifier as continuing task
approval. If the handle is unavailable, use an explicit task selector only
for an explicitly identified task; do not claim automatic task delivery.

Rule, rationale, outcome, counterexample and tradeoffs are required single-line
strings of at most 600 characters. IDs and references are bounded identifiers;
topics are lowercase identifiers. A topic denotes one decision dimension, not
an entire language or architecture. Do not invent separate topics to hide a
real contradiction.

A complete non-conflicting proposal activates immediately. An overlapping
same-topic proposal remains pending. Preserve the existing rule and resolve
only after the user decides: `philosophy resolve <candidate-id> retain`,
`supersede`, `pending`, or `exception --scope <project|task> --scope-key <key>`.
Rollback appends history through `philosophy rollback <rule-id>`.

For explicit refinement, `philosophy refine --stdin` accepts a
`personalization-refinement.v1` object with `trigger: "explicit-refinement"`,
`classification: "personal-philosophy"` or `"project-decision"`, the approved
`currentRationale` and `preferredAlternative`, and the candidate above under
`candidate`. An implementation mistake needs code correction, not a profile
mutation. The classification must match the candidate's approved scope.

After persistence, verify the result with `philosophy status` and an actual
`context preview <relative-target> --json` (the approved checkout connection
supplies the project selector automatically; add `--task` only for an explicitly
identified task, or use the session's task Preview above). Then trace the approved decision to the
affected code and a focused test or review condition. Store success and Preview
are not evidence that a host model received or followed the rule.
