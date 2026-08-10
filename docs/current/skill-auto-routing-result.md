# Skill Auto-routing Result

## Goal

Make Persona Harness behave more like OMO for shared skills while keeping Persona specialization around backend, frontend, and infrastructure.

## Implemented

- Vendored OMO `shared-skills` under `packages/shared-skills`.
- `src/runtime/shared-skill-router.ts` keeps file-target routing narrow:
  TypeScript and Java targets select `programming` as supporting guidance.
- `src/runtime/top-level-intent-router.ts` activates one compact catalog
  reference from message intent. Explicit `/persona <skill-id>` commands win;
  malformed or unavailable commands fail closed without fallback.
- Ambiguous new-product requests start a one-question `deep-interview`;
  brownfield requests start code-first discovery. Clear direct work bypasses
  discovery.
- React/frontend targets select `programming`; `frontend` remains an explicit
  optional overlay.
- Java/Spring backend targets continue to use deterministic `.persona/rules`.

## Routing Behavior

| Target | Selected |
| --- | --- |
| `*.ts`, `*.mts`, `*.cts` | `programming` |
| `*.tsx` | `programming` |
| frontend-like paths such as `components/`, `pages/`, `app/`, `ui/`, `web/` with TypeScript | `programming` |
| Java/Spring backend files | backend `.persona/rules` only |
| infra-only files such as `Dockerfile` | no shared skill yet |

## Non-catalog Material

Legacy OMO orchestration payloads and maintenance-only material are not Persona
automatic-routing candidates. The Persona catalog is the authoritative list;
its optional extensions require an explicit request and available host support.

Removed `lcx-*` maintenance skills are not Persona runtime capabilities.

## React / Frontend Overlay

Frontend is an explicit optional overlay. Target path alone, including `.tsx` and frontend component/page/app directories, never injects it automatically.

This keeps all automatic TypeScript and React/frontend routing on `programming` only.

## Host Boundary

- No full skill-body or catalog injection.
- No OMO agent/team workflow copy.
- No automatic workflow, ticket, branch, file, issue, or agent progression.
- No frontend/infra project generation or replacement of `.persona/rules`.

## Verification

- Activation tests cover explicit-command precedence, direct-work precedence,
  product/brownfield first actions, suppression, and unavailable commands.
- Target-routing tests keep TypeScript and React/frontend on `programming` only
  and reject automatic `frontend` injection.
- Packed-install verification checks installed-only activation behavior without a
  source fallback or full skill-body route.

The canonical current contract is [Persona Shared Skills
Core](persona-shared-skills-core.md).
