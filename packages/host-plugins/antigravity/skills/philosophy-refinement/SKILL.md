---
name: ph-philosophy-refinement
description: "(PH) Use only when the user explicitly asks to change, review, or persist reusable development philosophy."
license: "Apache-2.0"
compatibility: "Codex and Antigravity"
metadata:
  persona-harness/canonical-skill: philosophy-refinement
  persona-harness/display-name: "(PH) Socratic Philosophy Refinement"
  persona-harness/adapter-layout: agents
  persona-harness/adapter-version: 0.12.0
  opencode/autoinvoke: "false"
---

# (PH) Socratic Philosophy Refinement

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Socratic Philosophy Refinement

Start only when the user explicitly asks to change, review, or persist a
reusable philosophy. Ordinary chat, code inspection, a direct code-change
request, design criticism, and implicit preference signals do not start this
skill.

Ask one question at a time, in this order: the current reason, why the
alternative is preferred, intended scope, a concrete counterexample or side
effect, and the trade-offs. Give a short recommendation after each answer and
keep unresolved answers pending. Do not infer missing rationale, scope, or
exceptions.

Classify a complete explicit outcome as an implementation mistake, a
project/task decision, or a personal philosophy candidate. Only a complete
candidate may be handed to `ph philosophy refine --stdin` as the structured
`personalization-refinement.v1` input. The CLI reuses the append-only profile
store: a non-conflicting candidate may activate, while an overlap remains
pending for explicit retain, exception, supersede, or pending resolution.

Do not write files, profile state, workflow state, plans, issues, branches, or
agents during the conversation. Never persist raw prompts, responses, code,
credentials, or absolute paths. This procedure is host-neutral and does not
require OpenCode or a model action.
