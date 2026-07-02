---
name: workflow-programming
description: "Use when a user asks for direct code creation or edits and no stronger requirements, debug, review, refactor, or git workflow intent applies. AI-facing direct programming rail."
---

# Programming Workflow

This skill is AI-facing. It is the fallback rail for direct implementation/editing requests when no stronger workflow rail applies.

## Non-Goals

- This does not bypass requirements workflow when README/requirements/product backlog signals exist.
- This does not bypass debug workflow when a failure signal exists.
- This is not generated app product-quality certification.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Programming Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

Intent classification: direct programming request.
Basis: the user asked for code creation or modification without a stronger requirements, debug, review, refactor, or git signal.
Next action: read the relevant files and current structure first, then implement only within the requested scope.

Required flow:
- Read the relevant files first. Do not invent a new structure from guesses.
- Follow the existing project structure and naming.
- Do not add features, refactor, or change policy outside the requested scope.
- After changes, run the relevant test/build/smoke command.
- Do not describe unverified items as complete.

Evidence checklist:
- Files inspected
- Files changed
- Verification command
- Unverified items

Non-goals:
- This does not replace requirements/debug/review/refactor/git rails.
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
<!-- /PH_RUNTIME_BLOCK -->
