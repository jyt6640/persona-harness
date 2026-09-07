---
name: philosophy-refinement
description: Use only when the user explicitly asks to change, review, or persist reusable development philosophy.
persona-skill: core
mutability: explicit-user-action
handoff: null
---

# Socratic Philosophy Refinement

Start only when the user explicitly asks to change, review, or persist a
reusable philosophy. Ordinary chat, code inspection, a direct code-change
request, design criticism, and implicit preference signals do not start this
skill.

Read the relevant approved decisions and code first. Ask only for missing
material rationale, alternatives, scope, counterexamples, or trade-offs, one
question at a time. Reassess what remains unresolved after each answer; there
is no mandatory order or question count. Explain the current question when
the user is unsure, honor stop immediately, and reuse already approved facts
and scope without asking again. Do not infer missing rationale or exceptions.

A topic represents one decision dimension. Complementary obligations may use
distinct precise topics; alternative choices for the same dimension stay on
the same topic. Different wording is not proof of contradiction. The V1
resolver treats overlapping same-topic records conservatively as unresolved,
not as a semantic judgment. Explain the concrete overlap and preserve all
required meaning in any user-approved consolidation. Never invent topic names
merely to bypass a real conflict or silently supersede a rule.

Classify a complete explicit outcome as an implementation mistake, a
project/task decision, or a personal philosophy candidate. Only a complete
candidate may be handed to `ph philosophy refine --stdin` as the structured
`personalization-refinement.v1` input. The CLI reuses the append-only profile
store: a non-conflicting candidate may activate, while an overlap remains
pending for explicit retain, exception, supersede, or pending resolution.
Read [the persistence contract](references/persistence.md) only at that approved
write boundary; it contains the existing structured formats and plugin bridge.

Do not write files, profile state, workflow state, plans, issues, branches, or
agents during the conversation. Never persist raw prompts, responses, code,
credentials, or absolute paths. This procedure is host-neutral and does not
require OpenCode or a model action.
