# Rail Compliance Evidence Design

## Goal

Record report-only evidence when the AI's observable tool behavior appears to drift from the selected Persona Harness workflow rail.

This is not an enforcement gate. It does not fail builds, tests, OpenCode runs, or generated projects.

## Scope

Covered rails:

- requirements
- debug
- review
- refactor
- git
- programming

Observed behavior:

- file edit/write/patch tools
- shell/git command text
- `ph workflow split` / `ph workflow next`
- `ph bearshell` verification
- workflow implementation/review report status

Evidence output:

- `.persona/evidence/phase0/*.json`
- schema version: `phase0.rail-compliance.1`
- finding: `WARN`
- report-only payload with rail, user prompt, observed action, expected action, and confidence

## Current Checks

| Rail | Mismatch | Evidence Code |
| --- | --- | --- |
| review | File modification observed during review rail | `review-rail-file-modification` |
| requirements | File modification before `ph workflow split` or `ph workflow next` | `requirements-rail-direct-implementation` |
| debug | File modification before test/build/smoke reproduction evidence | `debug-rail-edit-without-reproduction` |
| git | `git commit`, `git push`, or `git tag` before both `git status` and `git diff` | `git-rail-mutation-without-status-diff` |
| any rail | Raw final verification observed without `npx ph bearshell` verification before finish/check | `raw-final-verification-without-bearshell` |
| any rail | implementation or review workflow report is missing/not filled at finish/check | `workflow-report-missing` |

## Non-Goals

- No autonomous role-agent implementation.
- No AST/linter/enforcement gate.
- No build/test failure gate.
- No frontend/infra expansion.
- No generated app product-quality certification.

## Limitations

This is string/tool-observation based. It can miss behavior hidden in custom scripts and can warn on legitimate advanced workflows. Debug hypothesis quality is not machine-verified; the current check only observes whether reproduction-like commands happened before edits.

## Next

Add stop/continuation hook evidence so long README/backlog runs that stop midstream can point to the next pending ticket and remaining requirement range.
