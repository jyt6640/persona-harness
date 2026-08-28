---
name: grill-me
description: Pressure-test a concrete decision, design, or plan only when the user asks to examine assumptions, alternatives, risks, or trade-offs.
persona-skill: core
mutability: conversation-only
handoff: none
---

# Decision Grill

Use this for a concrete decision, design, or plan when the user asks to
pressure-test its assumptions, alternatives, risks, trade-offs, or failure
modes. A host may select it automatically only when both the concrete subject
and the pressure-test signal are present. Otherwise wait for an explicit
`/persona grill-me` request or use the more specific existing route.

Inspect relevant code or documents before asking for facts they can establish.
Identify the most consequential assumption, ask one question at a time, then
give a short recommendation and its trade-off. Challenge vague claims with a
specific counterexample or failure mode. Finish with the unresolved decision,
the evidence that would change the recommendation, and the user's chosen next
step.

Use `deep-interview` for an ambiguous product outcome, `ralplan` for an
explicit adversarial review of an approved high-risk delivery plan, and
`review`, `debug`, or `programming` for their respective code requests.

Do not create files, plans, tickets, branches, issues, agents, project state,
or workflow state. This skill does not approve or advance a later procedure.
