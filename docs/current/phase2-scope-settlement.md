# Phase 2 Scope Settlement

## Goal

Separate the current Java backend MVP boundary from the experimental multi-domain shared-skill surface.

This is a scope settlement. It does not add a new router, observer, rule, or enforcement gate.

## Current Runtime Facts

`src/phase0/shared-skill-router.ts` is wired into `createInjectionBlock`.

Current automatic shared-skill routing is limited to:

- Java and Gradle targets select `programming` as a supporting shared skill while still loading Java backend rules from `.persona/rules`.
- TypeScript targets select `programming`.
- React/frontend TypeScript targets select `programming`; `frontend` is an explicit optional overlay, not an automatic selection.
- Infrastructure-looking targets do not select an active skill today and fall through to `shared-skill` role with no rules.

The current shared-skill catalog contains concise Persona-owned entries. Its
only retained third-party source component is the optional `ast-grep` material,
which carries an explicit MIT source marker and license. The former dormant OMO
reference trees are removed from source under the
[`2026-08-22-source-provenance-audit`](../evidence-reviews/2026-08-22-source-provenance-audit.md).

`lcx-report-bug`, `lcx-contribute-bug-fix`, and `lcx-doctor` remain intentionally removed.

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

Future third-party skill material requires an explicit compatible license,
required notices, and a future scope decision before it enters source.

## Active vs Inactive Surface

| Surface | Current status | Product meaning |
| --- | --- | --- |
| Java/Spring `.persona/rules` | active | MVP baseline |
| Java/Gradle `programming` selected skill | limited active support | supports injection metadata, not a replacement rule source |
| TypeScript `programming` selected skill | experimental | smoke path only |
| React/frontend `frontend` optional overlay | experimental | explicit selection only; not frontend MVP |
| `infra` file role | parking | no active rules or skill |
| `shared-skill` file role | parking | fallback role only |
| MIT `ast-grep` optional extension | explicit optional overlay | no AST/linter/enforcement gate |
| Persona `debug`, `visual-qa`, `refactor`, and `git` catalog entries | advisory catalog guidance | no runtime gate |
| Former dormant OMO source trees | removed | no source, runtime, or package contract |
| Java no-excuse fixtures under shared skills | inactive reference/test asset | no Persona Harness enforcement |

## Non-Goals

- Do not reintroduce dormant reference trees without a compatible license and scope decision.
- Do not add frontend, infra, or shared-skill rules.
- Do not implement a shared-skill loader.
- Do not wire `ast-grep` into observer, guard, linter, or enforcement paths.
- Do not claim product quality from the current A/B data.
- Do not continue package naming A/B loops as a substitute for effect evidence.

## Progress Board Correction

The previous wording "not wired into the current backend rule MVP" was too broad.

More precise wording:

- shared skills are a reusable package with a concise catalog boundary,
- the sole retained third-party component is explicitly MIT-licensed `ast-grep`,
- `programming` is currently selected for Java/Gradle and TypeScript targets,
- `frontend` is available only as an explicit optional overlay and is never selected from a React/frontend target path alone,
- this limited routing is experimental outside Java backend support and does not make the MVP multi-domain.

## Next Decision

Do not add another observer or broaden skill routing by default.

Next practical decision:

1. Define a narrow Java backend Clean Code uniformity rubric that is not just package-name exactness, or
2. move to MVP productization/demo packaging with the Java backend scope explicitly stated.
