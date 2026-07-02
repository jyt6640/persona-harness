---
name: workflow-review
description: "Use when a user asks for review, audit, QA, verification, or cold analysis without asking for fixes. AI-facing review rail for findings-first, read-only review."
---

# Review Workflow

This skill is AI-facing. It routes prompts like `리뷰해줘`, `검토해줘`, or `냉정하게 봐봐` into findings-first review instead of silent code edits.

## Non-Goals

- This is not an automatic fix rail.
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Review Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

Intent classification: review request.
Basis: the user is asking for review, analysis, or QA rather than implementation.
Next action: do not edit; present findings first.

Required flow:
- Do not modify code.
- First confirm the current goal, change scope, and relevant files.
- Write findings first, ordered by severity.
- Each finding must include file/line/evidence/impact.
- If there are no issues, say `No findings` clearly and list residual risks.
- Make fixes only when the user explicitly requests them, and then use a separate implementation/debug/refactor rail.

Evidence checklist:
- Reviewed files
- Commands or evidence inspected
- Findings with file/line/evidence/impact
- Residual risks

Non-goals:
- This is not an automatic fix rail.
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- Do not start implementation or refactoring.
<!-- /PH_RUNTIME_BLOCK -->
