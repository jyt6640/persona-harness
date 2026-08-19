---
name: philosophy-refinement
persona-skill: core
mutability: explicit-user-action
handoff: null
---

# Socratic Philosophy Refinement

Start only when the user explicitly critiques a design or implementation, or
explicitly asks for philosophy refinement. Ordinary chat, code inspection, and
implicit preference signals do not start this skill.

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
