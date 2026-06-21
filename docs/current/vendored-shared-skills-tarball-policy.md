# Vendored Shared-skills Package Policy

## Decision

Keep the full `packages/shared-skills` tree in the repository, but do not ship the full tree in the public `v0.3.0-alpha.0` npm tarball.

The alpha tarball includes only the Java MVP subset:

- `packages/shared-skills/skills/programming/SKILL.md`
- `packages/shared-skills/skills/programming/references/java`

This keeps the Java/backend guidance inspectable without packaging inactive OMO skills, no-excuse fixtures, frontend references, debugging references, AST tooling, or workflow skills as public support surfaces.

## Release-facing Scope

Including `packages/shared-skills` in the tarball does not expand the release-facing MVP.

The only productized `v0.3.0-alpha.0` surface remains:

- Java/Spring backend Clean Code injection,
- Gradle-first Java/Spring target support,
- `.persona/rules` loading,
- metadata-only evidence,
- `ph init`,
- `ph intake`,
- `ph policy`,
- `ph plan`,
- `ph history`,
- `npx ph bearshell`,
- npm alpha/local/tarball install.

## Packaged Reference Surface

These vendored skills remain in the repo as reference material, but they are not included in the alpha tarball and are not public support surfaces:

- `ast-grep`
- `debugging`
- `frontend`
- `git-master`
- `lsp-setup`
- `refactor`
- `remove-ai-slops`
- `review-work`
- `start-work`
- `ulw-plan`
- `ultraresearch`
- `visual-qa`

The `programming` routing experiment remains limited to Java MVP packaging through the Java reference subset. `frontend` routing remains non-release-facing unless a later scope decision productizes it.

## Explicit Non-Claims

Vendored shared-skills are not:

- an enforcement gate,
- a Guard/AST/linter product surface,
- generated application quality certification,
- frontend/infra/desktop productization,
- public support coverage for every included skill,
- a promise that OMO workflow behavior is available through Persona Harness.

## Known Tradeoff

Keeping the full `packages/shared-skills` tree in the tarball increased package size and shipped inactive fixture/reference content into external tester projects.

Current rationale for trimming public package contents:

- the alpha package is public-registry-facing;
- clean project evidence should not be polluted by installed package fixture files;
- inactive shared-skills should not look like supported product surfaces;
- Java MVP users still get the relevant programming reference material;
- the repo can still keep the full vendored tree for future 1.0 design work.

## 1.0 Activation Policy

Before `1.0.0`, decide a broader shared-skills activation policy:

- which skills become productized support surfaces,
- which skills remain packaged references,
- which skills should be trimmed from public packages,
- how activation is represented in README/support docs,
- whether any skill can participate in OpenCode injection by default,
- how to avoid confusing packaged reference content with enforcement.

Until that policy exists, keep the full vendored tree out of the public package except for the Java MVP programming subset.
