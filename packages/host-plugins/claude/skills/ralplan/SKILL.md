---
name: ph-ralplan
description: "(PH) Use only when the user explicitly asks for an adversarial review of a high-risk delivery plan."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: ralplan
  persona-harness/display-name: "(PH) Adversarial Plan Review"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.13.0
  opencode/autoinvoke: "false"
---

# (PH) Adversarial Plan Review

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Adversarial Plan Review

Use only on explicit request for a high-risk plan. Challenge assumptions,
identity and failure boundaries, rollout risks, and verification gaps. Return
findings and corrections to the plan. It is not an agent swarm, workflow rail,
or automatic implementation trigger.
