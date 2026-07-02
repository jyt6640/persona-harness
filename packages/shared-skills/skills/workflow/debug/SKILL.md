---
name: workflow-debug
description: "Use when a user reports a failure, error, broken behavior, failing test, crash, hang, or asks why something does not work. AI-facing debug rail for reproduction, hypotheses, confirmed root cause, and verification."
---

# Debug Workflow

This skill is AI-facing. It routes short prompts such as `왜 안돼?`, `테스트가 실패해`, or `버그 고쳐줘` away from direct implementation and into a debug-first workflow.

## Non-Goals

- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- This is not the README/requirements implementation workflow.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Debug Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

Intent classification: debug request.
Basis: the prompt asks to resolve a failure, error, or broken behavior.
Next action: do not start with implementation; reproduce first, then record hypotheses and evidence.

Required flow:
- Reproduce the failure first. Record the failing command, key error, and observed symptoms.
- Form at least three hypotheses. Each hypothesis must cover a distinct cause axis.
- Record confirm/refute evidence for each hypothesis. Do not fix from guesses alone.
- Fix only the confirmed cause. Do not add unrelated refactors or features.
- After the fix, rerun the same failing command.
- Rerun relevant tests/build/smoke and report the result.

Evidence checklist:
- Reproduction command
- Observed failure
- Hypothesis 1 / evidence
- Hypothesis 2 / evidence
- Hypothesis 3 / evidence
- Confirmed root cause
- Verification command

Non-goals:
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- Do not perform broad refactoring without a confirmed cause.
- This is not the README/requirements implementation workflow.
<!-- /PH_RUNTIME_BLOCK -->
