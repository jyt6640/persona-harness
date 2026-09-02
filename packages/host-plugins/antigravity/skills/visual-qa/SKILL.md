---
name: ph-visual-qa
description: "(PH) Use only when the user explicitly requests visual verification and a compatible host can render the UI."
license: "Apache-2.0"
compatibility: "Codex and Antigravity"
metadata:
  persona-harness/canonical-skill: visual-qa
  persona-harness/display-name: "(PH) Visual QA Overlay"
  persona-harness/adapter-layout: agents
  persona-harness/adapter-version: 0.12.0
  opencode/autoinvoke: "false"
---

# (PH) Visual QA Overlay

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Visual QA Overlay

Use only when a compatible host can render the UI. Compare the result with
explicit visual acceptance criteria and report what was actually observed. If
rendering is unavailable, say so without fabricating a visual check.
