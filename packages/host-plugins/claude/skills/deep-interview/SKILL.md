---
name: ph-deep-interview
description: "(PH) Use only for an ambiguous product request; ask one plain-language question before proposing a brief."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: deep-interview
  persona-harness/display-name: "(PH) Product Deep Interview"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.11.0
  opencode/autoinvoke: "false"
---

# (PH) Product Deep Interview

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

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
