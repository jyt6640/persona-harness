# Skill Auto-routing Result

## Goal

Make Persona Harness behave more like OMO for shared skills while keeping Persona specialization around backend, frontend, and infrastructure.

## Implemented

- Vendored OMO `shared-skills` under `packages/shared-skills`.
- Added a minimal shared skill router in `src/phase0/shared-skill-router.ts`.
- TypeScript targets select `programming`.
- React/frontend TypeScript targets select `programming` plus `frontend`.
- LazyCodex/Codex maintenance-only `lcx-*` skills were removed from the Persona Harness copy.
- Non-current skills remain vendored but inactive and are not automatic routing candidates.
- Java/Spring backend targets continue to use deterministic `.persona/rules` and do not force TypeScript shared skills.
- Shared skill selections are included in the injection block and metadata-only evidence.

## Routing Behavior

| Target | Selected |
| --- | --- |
| `*.ts`, `*.mts`, `*.cts` | `programming` |
| `*.tsx` | `programming`, `frontend` |
| frontend-like paths such as `components/`, `pages/`, `app/`, `ui/`, `web/` with TypeScript | `programming`, `frontend` |
| Java/Spring backend files | backend `.persona/rules` only |
| infra-only files such as `Dockerfile` | no shared skill yet |

## Inactive / Removed Skills

Inactive vendored skills are intentionally available as reference material but excluded from automatic routing: `debugging`, `visual-qa`, `ast-grep`, `git-master`, `refactor`, `review-work`, `start-work`, `ulw-plan`, `ultraresearch`, `init-deep`, `remove-ai-slops`, and `lsp-setup`.

Removed skills are not vendored: `lcx-report-bug`, `lcx-contribute-bug-fix`, and `lcx-doctor`.

## React / Frontend Overlay

React/frontend overlay is intentionally narrow for now.

It only activates when the target path clearly looks frontend-oriented, such as `.tsx` or frontend component/page/app directories.

This keeps ordinary TypeScript modules on `programming` only.

## Non-Goals

- No full skill loader yet.
- No OMO agent/team workflow copy.
- No product-quality gate.
- No frontend/infra project generation.
- No replacement of `.persona/rules`.

## Verification

- Red test added first in `tests/phase0-shared-skill-routing.test.ts`.
- TypeScript target smoke expects `programming`.
- React component target smoke expects `programming` and `frontend`.
- Inactive vendored skills are asserted to stay out of automatic routing.
- Removed `lcx-*` skill directories are asserted absent.
- Hook smoke confirms TypeScript file access receives a Persona Harness injection block.

## Next

The Gradle Java/Spring Injection ON/OFF A/B pair was run in `experiments/phase0-runs/2026-06-18T10-55-43-325Z`.

Next decision belongs to backend Clean Code uniformity validation, not shared-skill routing.
