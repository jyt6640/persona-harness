---
name: ph-review
description: "(PH) Use to review a scoped implementation and report evidence-based findings before suggesting changes."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: review
  persona-harness/display-name: "(PH) Review"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.13.0
  opencode/autoinvoke: "false"
---

# (PH) Review

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Review

Report findings first, ordered by impact and grounded in code or verification
evidence. Separate confirmed defects from residual test gaps. Do not edit or
advance workflow state unless the user explicitly asks for a follow-up change.
