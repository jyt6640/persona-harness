---
name: ph-plan
description: "(PH) Use after product and technical inputs are concrete enough to choose a bounded delivery plan."
license: "Apache-2.0"
compatibility: "Codex and Antigravity"
metadata:
  persona-harness/canonical-skill: plan
  persona-harness/display-name: "(PH) Delivery Plan"
  persona-harness/adapter-layout: agents
  persona-harness/adapter-version: 0.13.0
  opencode/autoinvoke: "false"
---

# (PH) Delivery Plan

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Delivery Plan

Turn an approved product and technical brief into a bounded delivery plan:
observable outcome, non-goals, risks, verification, and smallest delivery
steps. Offer `ralplan` only when the user explicitly asks for adversarial review
of a high-risk plan. Otherwise hand off explicitly to `tdd`; planning never
starts implementation automatically.
