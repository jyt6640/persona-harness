---
name: deep-interview
description: Resolve material product uncertainty with evidence-based, answer-dependent questions; skip facts and decisions already established.
persona-skill: core
mutability: explicit-user-action
handoff: technical-intake
---

# Product Deep Interview

Use when an unresolved product choice materially changes the requested result.
Read relevant code, active philosophy, and approved decisions first. Do not ask
the user to repeat facts those sources establish. A clear, reversible request
can proceed without an interview while retaining its applicable philosophy.

Show `(PH) Product Deep Interview` once when selected. Keep a small working list
of unresolved decisions, not a fixed questionnaire. For each, identify the
affected scope, available evidence, consequence of a wrong choice, options,
recommendation and its tradeoff. Ask only the most consequential applicable
question, in plain language, then wait. Consider concurrency, duplicate requests,
permissions, external contracts, data changes and recovery only when they can
change this task's implementation. Do not turn this list into mandatory topics.

After each answer, update that decision and reassess the remaining choices.
For example, choosing an existing identity provider can remove provider-design
questions while leaving an unresolved account-linking policy. A choice to keep
an operation local removes external-delivery questions. These are examples, not
a sequence to apply to every product. Prefer `2 decisions resolved, 1 remaining`
to an invented percentage; new evidence can change the remaining count. Neither
count nor interview completion proves that the user understands every risk.

Explain the current question when the user says they do not understand; do not
advance. A status question does not answer a decision. A correction updates the
affected decision and only its dependents. Stop immediately on cancellation,
including natural-language requests; do not ask whether to defer each topic or
restart without an explicit request. A deferred material data-loss or external
contract choice still blocks the implementation it affects, not unrelated work.

An explicit choice approves that decision within the stated scope. Reuse it
without another ritual approval; reopen it only when its scope or relevant
contract changes. Before implementing newly discovered or expanded scope, show
the unresolved tradeoff and obtain the required authorization. Existing task
authorization remains valid for unchanged scope. Do not infer permission to
create issues, branches, agents, external actions, or workflow state.

When authorized to retain decisions, update the project's existing approved
decision document rather than saving the conversation: decision, scope, evidence,
adopted tradeoff, residual risk and the contract/version that makes it applicable.
Link each decision to its intended code boundary and verification condition.
Persist only approved decisions; inferred facts and unresolved options are not
user approval. If durable storage is unavailable, say reuse is conversation-only.

## Existing CLI compatibility

The explicitly invoked `ph interview` v1 command remains an eight-topic durable
product-discovery exchange with its own progress and terminal approval contract.
Do not invoke it automatically for the adaptive conversation above, invent v2
CLI flags, or reinterpret its record as approval of unasked technical choices.

For a host-neutral durable exchange, an explicitly invoked `ph interview`
command can return a bounded JSON state. Keep that active state private to the
host or caller: it is bound to the initialized project and cannot be reused as
active state in another project. On explicit approval, it writes only
`.persona/decisions/socratic-interview.json`: a structured decision record that
may be committed to Git. The approved record intentionally omits that local
project binding so it can be shared; it never becomes active state. It never
stores session IDs, prompts, raw transcripts, or host metadata. Malformed,
stale, foreign, symlinked, or version-mismatched active state must fail closed
before a new question or a project write.

After material decisions are resolved, continue the authorized implementation
or use technical intake when delivery facts are genuinely missing. Check the
actual diff and test results against approved decisions. Delivered instructions,
generated code and verified conformance are distinct observations.
