---
name: ph-ast-grep
description: "(PH) Use only when the user explicitly requests AST-aware search or rewrite and the tool is available."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: ast-grep
  persona-harness/display-name: "(PH) AST-Grep Overlay"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.11.0
  opencode/autoinvoke: "false"
---

# (PH) AST-Grep Overlay

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# AST-Grep Overlay

Use only when `ast-grep` is available and explicitly requested. Keep structural
queries scoped, inspect matches before rewriting, and validate the changed
behavior. Do not claim the tool exists on an unsupported host.
