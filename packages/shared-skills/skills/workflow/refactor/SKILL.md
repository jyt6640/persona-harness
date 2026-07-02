---
name: workflow-refactor
description: "Use when a user asks to refactor, restructure, clean up, simplify, or improve code structure while preserving behavior. AI-facing refactor rail for behavior baseline and same verification rerun."
---

# Refactor Workflow

This skill is AI-facing. It routes prompts like `리팩터링해줘`, `구조 정리해줘`, or `cleanup 해줘` into behavior-preserving structural work.

## Non-Goals

- This is not a new-feature rail.
- This is not the debug rail.
- This is not generated app product-quality certification.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Refactor Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

Intent classification: refactor request.
Basis: the user asked for structural cleanup/improvement rather than a new feature.
Next action: lock current public behavior first, then perform a small structural change.

Required flow:
- First lock current public behavior with tests/build/smoke or observable evidence.
- Do not add features. Requirement changes, API expansion, and bug fixes belong to separate rails.
- Keep the scope small and address one structural issue at a time.
- Make only behavior-preserving changes such as naming, layering, duplication removal, or responsibility separation.
- After the structural change, rerun the same test/build/smoke command.
- Report verification results and residual risks.

Evidence checklist:
- Baseline behavior evidence
- Refactor scope
- Files changed
- Same verification command after refactor
- Residual risks

Non-goals:
- This is not the implementation/debug rail.
- This is not a new-feature rail.
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
<!-- /PH_RUNTIME_BLOCK -->
