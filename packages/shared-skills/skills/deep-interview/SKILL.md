---
name: deep-interview
description: Use only for an ambiguous product request; ask one plain-language question before proposing a brief.
persona-skill: core
mutability: conversation-only
handoff: technical-intake
---

# Product Deep Interview

Use only for product discovery before technical intake. Ask one question at a
time about the user, problem, outcome, journey, MVP, non-goals, success signal,
and product constraints. Give one short recommendation with a tradeoff.

Free text, `recommend`, `defer`, and `stop` are valid responses. Do not create
files, plans, tickets, branches, issues, agents, project state, or workflow
state. When decisions are sufficiently resolved, show a compact approval brief
and wait for explicit approval. Approval hands off to `technical-intake`; it
does not run it.

For a brownfield change, inspect relevant existing code first and ask only for
product intent the code cannot answer. That read is still advisory and does
not authorize a workflow transition.
