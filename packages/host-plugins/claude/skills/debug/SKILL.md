---
name: ph-debug
description: "(PH) Use for a reproducible failure or unexpected behavior; reproduce, isolate, and verify the cause."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: debug
  persona-harness/display-name: "(PH) Debug"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.13.0
  opencode/autoinvoke: "false"
---

# (PH) Debug

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Debug

Reproduce the observed failure, form bounded hypotheses, and fix only the
confirmed cause. Add a focused regression where appropriate and avoid turning
an investigation into automatic workflow progression or a broad refactor.
