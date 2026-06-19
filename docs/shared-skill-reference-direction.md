# Shared Skill Vendoring Direction

## Context

`references/oh-my-openagent/packages/shared-skills` shows a useful shape for reusable agent skills:

- a `skills/<name>/SKILL.md` router file
- optional per-skill `references/`
- optional per-skill `scripts/`
- optional per-skill agent declarations
- a tiny package surface that exposes the shared skills root

The important point is that the shared-skills package is mostly authored content, not runtime policy. The skill loader or harness adapter decides when and how to apply it.

## Decision

Persona Harness vendors this structure directly under `packages/shared-skills`.

The current copy started as a direct copy of the OMO shared-skills package, but Persona Harness now intentionally diverges by removing LazyCodex/Codex maintenance-only `lcx-*` skills. Future `diff -qr references/oh-my-openagent/packages/shared-skills packages/shared-skills` output should only show intentional Persona-specific pruning or adaptation.

The first important skill is `programming` because it already expresses cross-language development discipline such as strict typing, TDD, parse-don't-validate, boundary parsing, and file-size awareness.

Copying the shared skill content does not mean copying the entire OMO workflow or agent orchestration system into the current backend rule MVP.

The product direction is OMO-like behavior with Persona-specific specialization:

- OMO-like: discover/load reusable skills when the task needs them.
- Persona-specific: route the skill content around backend, frontend, and infrastructure work.
- Backend: Clean Code, architecture responsibility, persistence boundary, Gradle/Spring defaults when applicable.
- Frontend: TypeScript/React-oriented programming and UI implementation guidance.
- Infrastructure: stack/runtime/deployment guidance selected by project context.

## Why

Backend Clean Code uniformity and shared development skills are related but not the same layer.

`.persona/rules` should remain the deterministic injection baseline for the current Java/Spring backend MVP.

Shared skills are now vendored as the future reusable guidance layer for agent work across backend, frontend, and infrastructure.

This keeps the current backend rule surface narrow while preserving the user's larger direction:

- backend work can use backend philosophy when selected
- frontend TypeScript/React work can use frontend-oriented TypeScript guidance
- infrastructure work can use its own stack guidance
- if no personal philosophy exists, the harness still falls back to default Clean Code plus minimal project intake

The harness should eventually feel OMO-like in operation, but the skill map should be Persona-specific rather than a generic OMO clone.

## Programming Skill Boundary

The `programming` skill should not become a Java/Spring backend rule.

It should be a shared skill reference that an agent loads when doing implementation work in supported languages.

For TypeScript, Persona Harness should eventually bias the reference toward React/frontend usage because the user's expected TypeScript work is primarily React. Backend TypeScript stacks such as Hono can remain optional references, not the default assumption.

## Vendored Structure

The repo keeps the OMO package shape, with Persona-specific pruning:

```text
packages/shared-skills/
├─ package.json
├─ index.mjs
├─ index.d.ts
└─ skills/
   └─ programming/
      ├─ SKILL.md
      ├─ references/
      │  ├─ go/
      │  ├─ python/
      │  ├─ rust/
      │  ├─ rust-ub/
      │  └─ typescript/
      └─ scripts/
```

The package should remain mostly data:

- no rule selection engine
- no observer gate
- no product-quality certification
- no OMO workflow copy
- no OpenCode/Codex-specific behavior inside the shared package

Harness adapters can consume the shared skill directory later. The current runtime already has a minimal adapter path, so the distinction is now between limited active support and productized multi-domain routing.

The current minimal adapter behavior is:

- Java and Gradle targets select `programming` as a supporting shared skill while Java backend rules still come from `.persona/rules`.
- TypeScript targets select `programming`.
- React/frontend TypeScript targets select `programming` plus `frontend`.
- TypeScript and frontend routing are experimental smoke paths, not productized MVP domains.
- Infrastructure-looking targets currently have no active skill and no rules.
- `debugging`, `visual-qa`, `ast-grep`, `git-master`, `refactor`, `review-work`, `start-work`, `ulw-plan`, `ultraresearch`, `init-deep`, `remove-ai-slops`, and `lsp-setup` remain vendored but inactive.
- `lcx-report-bug`, `lcx-contribute-bug-fix`, and `lcx-doctor` are removed because they are LazyCodex/Codex maintenance workflows rather than Persona Harness skill guidance.

## Relationship To Current Rules

Current baseline rules stay in `.persona/rules`.

Strong current backend baseline:

- Java/Spring uses Gradle by default and does not generate Maven files.
- Application Service does not directly own storage state or id sequence.
- Controller, Service, Repository, DTO responsibility separation remains the default Clean Code flow.

Vendored shared skill layer:

- limited active `programming` support for Java/Gradle and TypeScript targets
- experimental `frontend` support for React/frontend TypeScript targets
- inactive reference material for broader OMO skills
- future backend/frontend/infra philosophy overlays only after an explicit scope decision

Future routing should decide which shared skill/reference applies from the current work domain:

- `backend`
- `frontend`
- `infra`

Full domain routing is a later implementation step. The current implementation only covers Java/Gradle support plus narrow TypeScript and React/frontend smoke paths.

## Non-Goals

- Do not implement a shared skill loader in this loop.
- Do not adapt OMO workflow/team/agent orchestration.
- Do not turn TypeScript backend preferences into Persona Harness defaults.
- Do not replace `.persona/rules` with skills.

## Next Loop Candidate

Keep the immediate active work on Gradle canonical A/B validation.

After that, choose one of:

1. Design the Persona Harness adapter/loader that consumes `packages/shared-skills`.
2. Design the frontend TypeScript/React programming reference.
3. Design the philosophy/intake harness that selects backend/frontend/infra guidance.
