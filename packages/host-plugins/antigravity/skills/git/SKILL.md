---
name: ph-git
description: "(PH) Use only for an explicit Git operation with scoped status, diff, and transport discipline."
license: "Apache-2.0"
compatibility: "Codex and Antigravity"
metadata:
  persona-harness/canonical-skill: git
  persona-harness/display-name: "(PH) Git Hygiene"
  persona-harness/adapter-layout: agents
  persona-harness/adapter-version: 0.12.0
  opencode/autoinvoke: "false"
---

# (PH) Git Hygiene

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Git Hygiene

Inspect the relevant diff and status, stage only intended files, and perform
transport only when the user explicitly requests it. Never create branches,
commits, tags, releases, or pushes as a side effect of another skill.
