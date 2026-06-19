# Vendored Shared-skills Tarball Policy

## Decision

Keep `packages/shared-skills` in the `v0.2.0-alpha` tarball.

Do not trim the vendored shared-skill tree for the alpha package. The current copy is an intentional reference asset for the 1.0 direction, and removing it now would create churn before the activation policy is settled.

## Release-facing Scope

Including `packages/shared-skills` in the tarball does not expand the release-facing MVP.

The only productized `v0.2.0-alpha` surface remains:

- Java/Spring backend Clean Code injection,
- Gradle-first Java/Spring target support,
- `.persona/rules` loading,
- metadata-only evidence,
- diagnostics-only reports,
- `ph init`,
- `npx ph bearshell`,
- local path and tarball install.

## Packaged Reference Surface

These vendored skills may be present in the tarball as reference material, but they are not public support surfaces in `v0.2.0-alpha`:

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

The `programming` and `frontend` routing experiments remain limited/experimental unless a later scope decision productizes them. They do not replace the Java/Spring `.persona/rules` baseline.

## Explicit Non-Claims

Vendored shared-skills are not:

- an enforcement gate,
- a Guard/AST/linter product surface,
- generated application quality certification,
- frontend/infra/desktop productization,
- public support coverage for every included skill,
- a promise that OMO workflow behavior is available through Persona Harness.

## Known Tradeoff

Keeping `packages/shared-skills` increases the tarball size.

Current rationale:

- the alpha package is local/tarball-first, not public-registry-first;
- the vendored content is useful for the 1.0 skill direction;
- trimming now would save package weight but risk later reintegration churn;
- the current support contract can stay honest by labeling the content as packaged reference/inactive surface.

## 1.0 Activation Policy

Before `1.0.0`, decide a shared-skills activation policy:

- which skills become productized support surfaces,
- which skills remain packaged references,
- which skills should be trimmed from public packages,
- how activation is represented in README/support docs,
- whether any skill can participate in OpenCode injection by default,
- how to avoid confusing packaged reference content with enforcement.

Until that policy exists, keep `packages/shared-skills` packaged but non-release-facing.
