# v0.6.0-rc.2 Release Capsule

This capsule is the durable index for the `0.6.0-rc.2` release-prep line. It
complements the release-operation notes in
[`docs/current/release/v0.6.0-rc.2-release-notes.md`](../../current/release/v0.6.0-rc.2-release-notes.md).

## Channel State

- Package metadata prepared as `0.6.0-rc.2`.
- Release target: npm dist-tag `next`, not `latest`.
- Pre-publish registry state remains `latest=0.5.0`,
  `next=0.6.0-rc.1`, and `alpha=0.3.9-alpha.8`.
- `persona-harness@0.6.0-rc.2` has no accepted registry evidence yet.
- No `v0.6.0-rc.2` tag should exist before registry gitHead/shasum
  verification.

## Durable Records

- [`release-facts.md`](release-facts.md): prep facts, included commits, and
  release boundaries.
- [`measurements.md`](measurements.md): scoped measurement and probe summaries
  that govern this release prep.

## Current Prep Addendum

`0.6.0-rc.2` is a prep candidate for post-rc1 docs and roadmap work:

- docs taxonomy and package-version indexing;
- ralph-loop measurement correction and fake-shim adversarial candidate;
- ralph-loop blocker-depth/finishable-fixture prep;
- archive-local external-loop prototype prep;
- OpenCode subagent capability probe;
- Role Checklist Relay naming/UX honesty;
- prompt regression fixture for measurement-safe wording.

Registry evidence remains NO-GO until a later publish includes these commits
and External registry smoke passes.

## Boundaries

Do not use this release capsule to claim token/provider-token saving, product
efficacy, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic role enforcement, production-ready delegation,
automatic completion/downgrade/removal, or CodeGraph/LSP default/effectiveness.
