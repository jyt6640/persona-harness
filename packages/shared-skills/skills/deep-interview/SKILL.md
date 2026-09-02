---
name: deep-interview
description: Use only for an ambiguous product request; visibly activate, ask one plain-language question at a time, and wait for explicit approval.
persona-skill: core
mutability: explicit-user-action
handoff: technical-intake
---

# Product Deep Interview

Use only for product discovery before technical intake. The durable portable
core is default-off: a host adapter or an explicit user request must select it.
Reading Context, resolving a skill catalog, or seeing a product-shaped phrase
does not authorize a command, a project write, or an interview by itself.

When selected, show a compact `(PH) Product Deep Interview` activation notice
and `10%` progress, then ask exactly one plain-language question. Continue in
ten-percent steps through the user, problem, outcome, journey, MVP, non-goals,
success signal, and product constraints. Give one short recommendation with a
tradeoff. If the user says they do not understand, explain the current question
in plain language before asking another decision question.

Free text, `recommend`, `defer`, and `stop` or `cancel` are valid responses. A
stop ends the current interview and does not restart it until the user explicitly
starts a new one. Do not create files, plans, tickets, branches, issues, agents,
project state, or workflow state by inference. When decisions are sufficiently
resolved, show a compact approval brief and wait for explicit approval. Approval
hands off to `technical-intake`; it does not run it.

For a host-neutral durable exchange, an explicitly invoked `ph interview`
command can return a bounded JSON state. Keep that active state private to the
host or caller. On explicit approval, it writes only
`.persona/decisions/socratic-interview.json`: a structured decision record that
may be committed to Git. It never stores session IDs, prompts, raw transcripts,
or host metadata. Malformed, stale, foreign, symlinked, or version-mismatched
state must fail closed before a new question or a project write.

For a brownfield change, inspect relevant existing code first and ask only for
product intent the code cannot answer. That read is still advisory and does
not authorize a workflow transition.
