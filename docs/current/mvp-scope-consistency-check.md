# MVP Scope Consistency Check

## Goal

Keep the Java backend MVP boundary aligned across runtime code and status documents.

The check is diagnostics-only. It reports scope drift but does not block injection, build, tests, packaging, or A/B runs.

`npm test` runs this check before Vitest so scope drift is visible during normal verification. Scope findings still exit `0`, including `WARN` findings. Only script execution errors, such as missing files or unreadable project paths, fail the npm command.

For release or CI-style checks, use strict mode. Strict mode keeps the same diagnostics but exits nonzero when the finding is `WARN`.

Structured source of truth:

- `docs/current/mvp-scope-status.json`

## Command

```sh
npm run check:scope
```

`npm test` also runs this check before unit tests.

```sh
npm run check:scope:strict
```

## Current Expected Boundary

- Java/Spring backend Clean Code injection remains the MVP.
- `programming` is active as limited support for Java/Gradle targets.
- TypeScript `programming` and React/frontend `frontend` routing are experimental.
- `infra` and generic `shared-skill` roles are parking surfaces.
- Vendored skills such as `ast-grep`, `debugging`, `visual-qa`, and `review-work` are inactive references unless a later scope decision activates them.

## What It Checks

- `ACTIVE_SHARED_SKILL_NAMES` still matches the settled active list.
- key vendored skills remain listed as inactive references.
- experimental FileRole names remain documented as experimental or parking surfaces.
- `docs/current/mvp-scope-status.json` stays aligned with router/type declarations.
- `docs/current/phase2-scope-settlement.md` and `docs/project-progress-board.md` still describe the same scope boundary.

## Non-Goals

- No frontend/infra productization claim.
- No AST/linter/enforcement gate.
- No automatic rollback.
- No build or test failure gate.
