---
name: ph-technical-intake
description: "(PH) Use after an approved product brief to collect project facts that materially affect delivery."
license: "Apache-2.0"
compatibility: "Claude Code"
metadata:
  persona-harness/canonical-skill: technical-intake
  persona-harness/display-name: "(PH) Technical Intake"
  persona-harness/adapter-layout: claude
  persona-harness/adapter-version: 0.12.0
  opencode/autoinvoke: "false"
---

# (PH) Technical Intake

This adapter exposes the canonical Persona Harness skill to this host only. Discovery alone does not authorize workflow, shell, network, GitHub, authority, evidence, or external actions.

# Technical Intake

Start only after an approved product brief. Gather project facts and technical
constraints that materially affect delivery. Read existing code before asking
for facts it already answers. Produce a concise technical brief, state unknowns,
and hand off explicitly to `plan`. Do not create workflow state or implementation
work merely because this intake is complete.
