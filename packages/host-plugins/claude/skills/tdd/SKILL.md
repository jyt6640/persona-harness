---
name: ph-tdd
description: "(PH) Use after an approved delivery boundary to define a focused failing behavior test before implementation."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: tdd
  persona-harness/display-name: "(PH) Test-First Delivery"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.12.0
  opencode/autoinvoke: "false"
---

# (PH) Test-First Delivery

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Test-First Delivery

State the observable behavior, add the smallest focused failing test, then make
it pass with the smallest scoped implementation. Keep negative and fail-closed
cases explicit. Hand off to `implementation` only after the behavior contract
is clear; this skill does not create tickets or workflow records.
