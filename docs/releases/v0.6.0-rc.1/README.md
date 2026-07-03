# v0.6.0-rc.1 Release Capsule

This capsule is the durable index for the `0.6.0-rc.1` release line and its
current post-rc1 measurement notes. It complements the release-operation notes
in [`docs/current/release/v0.6.0-rc.1-release-notes.md`](../../current/release/v0.6.0-rc.1-release-notes.md).

## Channel State

- `persona-harness@next=0.6.0-rc.1`.
- `0.6.0-rc.1` registry gitHead:
  `b673633533a314e1a64dd6dcb18c4097c5889a2c`.
- `0.6.0-rc.1` registry shasum:
  `5c8bcd5c1bd4165dd129e39624408672f88091ce`.
- `latest=0.5.0`.
- `alpha=0.3.9-alpha.8`.
- Local and remote `v0.6.0-rc.1` tags point to
  `b673633533a314e1a64dd6dcb18c4097c5889a2c` after registry verification.

External registry smoke archive:

`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage14-rc060-rc1-registry-smoke-20260703T100732Z`

The smoke source was registry `persona-harness@next` only; local-current
tarball evidence is recorded separately.

## Durable Records

- [`release-facts.md`](release-facts.md): registry facts, package-runtime
  observations, and release boundaries for the published prerelease.
- [`measurements.md`](measurements.md): scoped measurement and probe summaries
  that currently govern runtime injection, ralph-loop, relay, role-boundary,
  and scorecard interpretation.

## Current Post-rc1 Addendum

Some accepted current measurements happened after the published rc1 gitHead.
They are preserved here as local-current measurement facts, not registry
package evidence:

- ralph-loop idle delivery did not produce model-facing continuation in Stage
  12 retry pilots.
- the default-off hybrid tool-output trigger path is accepted as a
  local-current trigger-survival improvement;
- the n=15 tool-output trigger run passed trigger-survival criteria, but did
  not prove completion-integrity movement or a default change.

Registry evidence for those post-rc1 commits remains NO-GO until a future
publish includes them and External registry smoke passes.

## Boundaries

Do not use this release capsule to claim token/provider-token saving, product
efficacy, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic role enforcement, production-ready delegation,
automatic completion/downgrade/removal, or CodeGraph/LSP default/effectiveness.
