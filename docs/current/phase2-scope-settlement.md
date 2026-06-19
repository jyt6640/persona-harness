# Phase 2 Scope Settlement

## Goal

Separate the current Java backend MVP boundary from the experimental multi-domain shared-skill surface.

This is a scope settlement. It does not add a new router, observer, rule, or enforcement gate.

## Current Runtime Facts

`src/phase0/shared-skill-router.ts` is wired into `createInjectionBlock`.

Current automatic shared-skill routing is limited to:

- Java and Gradle targets select `programming` as a supporting shared skill while still loading Java backend rules from `.persona/rules`.
- TypeScript targets select `programming`.
- React/frontend TypeScript targets select `programming` plus `frontend`.
- Infrastructure-looking targets do not select an active skill today and fall through to `shared-skill` role with no rules.

Current vendored-but-inactive skills include:

- `debugging`
- `visual-qa`
- `ast-grep`
- `git-master`
- `refactor`
- `review-work`
- `start-work`
- `ulw-plan`
- `ultraresearch`
- `init-deep`
- `remove-ai-slops`
- `lsp-setup`

`lcx-report-bug`, `lcx-contribute-bug-fix`, and `lcx-doctor` are intentionally removed.

## Decision

Choose A: keep the current MVP scoped to Java/Spring backend Clean Code injection.

The current MVP is:

- deterministic `.persona/rules` injection for Java/Spring backend targets,
- Gradle-first Java/Spring guidance,
- backend Clean Code package/layer responsibility guidance,
- diagnostics-only rule metadata validation,
- A/B evidence collection for Java backend generation.

The shared-skill layer is not the productized MVP yet.

`programming` is allowed as a limited active support surface for Java/Gradle targets because it is already wired into the injection block and helps label the programming discipline context. It does not replace `.persona/rules` and does not become a Java/Spring rule source.

TypeScript/frontend routing is experimental. It may remain as a smoke path, but it should not be used to claim frontend productization.

Infrastructure and generic `shared-skill` roles are parking surfaces only. They should not be treated as MVP domains until there are real rules, tests, and product decisions behind them.

Vendored OMO skills are reference material unless explicitly activated by a future scope decision.

## Active vs Inactive Surface

| Surface | Current status | Product meaning |
| --- | --- | --- |
| Java/Spring `.persona/rules` | active | MVP baseline |
| Java/Gradle `programming` selected skill | limited active support | supports injection metadata, not a replacement rule source |
| TypeScript `programming` selected skill | experimental | smoke path only |
| React/frontend `frontend` selected skill | experimental | not frontend MVP |
| `infra` file role | parking | no active rules or skill |
| `shared-skill` file role | parking | fallback role only |
| `ast-grep` vendored skill | inactive reference | no AST/linter/enforcement gate |
| `debugging`, `visual-qa`, `review-work` vendored skills | inactive reference | no runtime gate |
| Java no-excuse fixtures under shared skills | inactive reference/test asset | no Persona Harness enforcement |

## Non-Goals

- Do not remove vendored skills in this loop.
- Do not add frontend, infra, or shared-skill rules.
- Do not implement a shared-skill loader.
- Do not wire `ast-grep` into observer, guard, linter, or enforcement paths.
- Do not claim product quality from the current A/B data.
- Do not continue package naming A/B loops as a substitute for effect evidence.

## Progress Board Correction

The previous wording "not wired into the current backend rule MVP" was too broad.

More precise wording:

- shared skills are vendored as a reusable package,
- most vendored skills are inactive references,
- `programming` is currently selected for Java/Gradle and TypeScript targets,
- `frontend` is selected only for React/frontend TypeScript targets,
- this limited routing is experimental outside Java backend support and does not make the MVP multi-domain.

## Next Decision

Do not add another observer or broaden skill routing by default.

Next practical decision:

1. Define a narrow Java backend Clean Code uniformity rubric that is not just package-name exactness, or
2. move to MVP productization/demo packaging with the Java backend scope explicitly stated.

