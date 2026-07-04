# Package Version Index

This index is the human-readable package/version timeline for Persona Harness.
It is based on repo-local evidence only: `CHANGELOG.md`, release-note files
under `docs/current/release/`, existing versioned capsules, package metadata,
and local git tags. This cleanup did not query npm registry state.

Use this index to scan package history. Use the linked release notes,
`CHANGELOG.md`, and version capsules for detailed evidence.

## Current Channel State

- Current package metadata in this repo: `0.6.0-rc.2`.
- Current prerelease channel: `persona-harness@next=0.6.0-rc.1` until
  `0.6.0-rc.2` is published after QA approval.
- Current stable channel: `persona-harness@latest=0.5.0`.
- Current alpha channel: `persona-harness@alpha=0.3.9-alpha.8`.
- `v0.6.0-rc.2` prep capsule:
  [`docs/releases/v0.6.0-rc.2/`](v0.6.0-rc.2/README.md).
- `v0.6.0-rc.1` capsule:
  [`docs/releases/v0.6.0-rc.1/`](v0.6.0-rc.1/README.md).

## Reading Rules

- `Documented date` comes from `CHANGELOG.md` when present.
- `Local tag` means a local git tag with the matching `v<version>` name exists
  in this checkout.
- `Registry/archive evidence` is included only where repo docs already record
  accepted registry/archive facts. Otherwise the row says `registry not checked
  in this cleanup`.
- Pre-`0.3.0` rows are included for chronology because users expect the series
  to start near `v0.1.0`; where the repo has no package record, the row says so.

## Chronological Timeline

| Version | Documented date | Channel/status | Primary docs | Registry/archive evidence |
| --- | --- | --- | --- | --- |
| `0.1.0` | not documented in repo | not documented in repo | none found | registry not checked in this cleanup |
| `0.2.0` | not documented in repo | not documented in repo | none found | registry not checked in this cleanup |
| `0.2.1` | not documented in `CHANGELOG.md` | support/readiness docs only | [`v0.2.1-package-metadata-audit.md`](../current/v0.2.1-package-metadata-audit.md), [`v0.2.1-release-readiness.md`](../current/v0.2.1-release-readiness.md), [`v0.2.1-support-contract.md`](../current/v0.2.1-support-contract.md) | registry not checked in this cleanup |
| `0.3.0-alpha.0` | 2026-06-21 | alpha line, changelog only | [`CHANGELOG.md`](../../CHANGELOG.md) | registry not checked in this cleanup |
| `0.3.0-alpha.1` | 2026-06-21 | alpha line, changelog only | [`CHANGELOG.md`](../../CHANGELOG.md) | registry not checked in this cleanup |
| `0.3.0-alpha.2` | 2026-06-21 | alpha line, changelog only | [`CHANGELOG.md`](../../CHANGELOG.md) | registry not checked in this cleanup |
| `0.3.0-alpha.3` | 2026-06-22 | alpha; local `v0.3.0-alpha.3` tag exists | [`candidate`](../current/release/v0.3.0-alpha.3-candidate.md), [`demo packaging decision`](../current/release/v0.3.0-alpha.3-demo-packaging-decision.md), [`release notes`](../current/release/v0.3.0-alpha.3-release-notes.md) | release notes record publish to `alpha` and registry verification that `alpha` and `latest` resolved to `0.3.0-alpha.3`; not rechecked in this cleanup |
| `0.3.1-alpha.0` | 2026-06-22 | alpha line | [`release notes`](../current/release/v0.3.1-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.1-alpha.1` | 2026-06-22 | alpha line, changelog only | [`CHANGELOG.md`](../../CHANGELOG.md) | registry not checked in this cleanup |
| `0.3.1-alpha.2` | 2026-06-22 | alpha line, changelog only | [`CHANGELOG.md`](../../CHANGELOG.md) | registry not checked in this cleanup |
| `0.3.2-alpha.0` | 2026-06-22 | alpha line | [`release notes`](../current/release/v0.3.2-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.2-alpha.1` | 2026-06-22 | alpha line | [`release notes`](../current/release/v0.3.2-alpha.1-release-notes.md) | registry not checked in this cleanup |
| `0.3.2-alpha.2` | 2026-06-22 | alpha line | [`release notes`](../current/release/v0.3.2-alpha.2-release-notes.md) | registry not checked in this cleanup |
| `0.3.2-alpha.3` | 2026-06-23 | alpha line | [`release notes`](../current/release/v0.3.2-alpha.3-release-notes.md), [`clean short request review`](../current/release/v0.3.2-alpha.3-clean-short-request-review.md), [`ON/OFF A/B review`](../current/release/v0.3.2-alpha.3-on-off-ab-review.md) | registry not checked in this cleanup |
| `0.3.3-alpha.0` | 2026-06-23 | alpha line | [`release notes`](../current/release/v0.3.3-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.4-alpha.0` | 2026-06-23 | alpha line | [`release notes`](../current/release/v0.3.4-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.5-alpha.0` | 2026-06-23 | alpha line | [`release notes`](../current/release/v0.3.5-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.6-alpha.0` | 2026-06-23 | alpha line | [`release notes`](../current/release/v0.3.6-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.6-alpha.1` | 2026-06-23 | alpha line | [`release notes`](../current/release/v0.3.6-alpha.1-release-notes.md) | registry not checked in this cleanup |
| `0.3.7-alpha.0` | 2026-06-24 | alpha line, changelog only | [`CHANGELOG.md`](../../CHANGELOG.md) | registry not checked in this cleanup |
| `0.3.7-alpha.1` | 2026-06-24 | alpha line | [`release notes`](../current/release/v0.3.7-alpha.1-release-notes.md) | registry not checked in this cleanup |
| `0.3.8-alpha.0` | 2026-06-24 | alpha line; local `v0.3.8-alpha.0` tag exists | [`release notes`](../current/release/v0.3.8-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.8-alpha.1` | 2026-06-24 | alpha line; local `v0.3.8-alpha.1` tag exists | [`release notes`](../current/release/v0.3.8-alpha.1-release-notes.md) | registry not checked in this cleanup |
| `0.3.8-alpha.2` | 2026-06-24 | alpha line | [`release notes`](../current/release/v0.3.8-alpha.2-release-notes.md) | registry not checked in this cleanup |
| `0.3.8-alpha.3` | 2026-06-25 | alpha line | [`release notes`](../current/release/v0.3.8-alpha.3-release-notes.md) | registry not checked in this cleanup |
| `0.3.8-alpha.4` | 2026-06-25 | alpha line | [`release notes`](../current/release/v0.3.8-alpha.4-release-notes.md) | registry not checked in this cleanup |
| `0.3.8-alpha.5` | 2026-06-25 | alpha line | [`release notes`](../current/release/v0.3.8-alpha.5-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.0` | 2026-06-25 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.0-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.1` | 2026-06-25 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.1-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.2` | 2026-06-27 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.2-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.3` | 2026-06-27 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.3-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.4` | 2026-06-28 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.4-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.5` | 2026-06-28 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.5-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.6` | 2026-06-28 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.6-release-notes.md) | registry not checked in this cleanup |
| `0.3.9-alpha.7` | 2026-06-29 | alpha line; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.7-release-notes.md) | release docs record Windows SSH registry implementation-to-finish usability PASS as workflow rail signal only; registry not rechecked in this cleanup |
| `0.3.9-alpha.8` | 2026-06-29 | current `alpha`; local tag exists | [`release notes`](../current/release/v0.3.9-alpha.8-release-notes.md) | current channel summary records `alpha=0.3.9-alpha.8`; registry not rechecked in this cleanup |
| `0.4.0-rc.1` | 2026-06-29 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.1-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.2` | 2026-06-30 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.2-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.3` | 2026-06-30 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.3-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.4` | 2026-06-30 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.4-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.5` | 2026-06-30 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.5-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.6` | 2026-06-30 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.6-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.7` | 2026-07-01 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.7-release-notes.md) | registry evidence summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.8` | 2026-07-01 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.8-release-notes.md) | registry TDD rail smoke summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.9` | 2026-07-01 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.9-release-notes.md) | registry package-runtime smoke summarized in release docs; not rechecked in this cleanup |
| `0.4.0-rc.10` | 2026-07-01 | `next` RC; local tag exists | [`release notes`](../current/release/v0.4.0-rc.10-release-notes.md) | registry LSP wrapper smoke summarized in release docs; not rechecked in this cleanup |
| `0.4.0` | 2026-07-01 | historical stable `latest`; local tag exists | [`release notes`](../current/release/v0.4.0-release-notes.md) | release notes record `latest=0.4.0`, gitHead, shasum, and External latest registry smoke archive |
| `0.4.1-rc.1` | 2026-07-02 | historical `next` RC; local tag exists | [`release notes`](../current/release/v0.4.1-rc.1-release-notes.md) | release docs record corrected `next=0.4.1-rc.1` registry smoke; not rechecked in this cleanup |
| `0.4.1-rc.2` | 2026-07-02 | historical `next` RC; local tag exists | [`release notes`](../current/release/v0.4.1-rc.2-release-notes.md) | release docs record `ab-run`/`pminus-report` registry package-runtime smoke; not rechecked in this cleanup |
| `0.5.0-rc.1` | 2026-07-02 | superseded wrong-channel RC; local tag exists | [`release notes`](../current/release/v0.5.0-rc.1-release-notes.md) | treated as wrong-channel/superseded in release docs, not accepted stable milestone |
| `0.5.0-rc.2` | 2026-07-02 | historical `next` RC; local tag exists | [`release notes`](../current/release/v0.5.0-rc.2-release-notes.md) | release docs record rc2 registry smoke and gate-first/default-off package behavior |
| `0.5.0` | 2026-07-03 | current stable `latest`; local tag exists | [`release notes`](../current/release/v0.5.0-release-notes.md) | release notes record `latest=0.5.0`, gitHead, shasum, Trusted Publisher/Release workflow runs, and External stable registry smoke archive |
| `0.6.0-rc.1` | 2026-07-03 | current published `next` RC until rc2 publish; local tag exists | [`capsule`](v0.6.0-rc.1/README.md), [`release facts`](v0.6.0-rc.1/release-facts.md), [`measurements`](v0.6.0-rc.1/measurements.md), [`release notes`](../current/release/v0.6.0-rc.1-release-notes.md) | capsule records `next=0.6.0-rc.1`, `latest=0.5.0`, `alpha=0.3.9-alpha.8`, gitHead, shasum, tag, and Stage 14 registry smoke archive |
| `0.6.0-rc.2` | 2026-07-04 | release-prep target for future `next`; not published/tagged in this prep | [`capsule`](v0.6.0-rc.2/README.md), [`release facts`](v0.6.0-rc.2/release-facts.md), [`measurements`](v0.6.0-rc.2/measurements.md), [`release notes`](../current/release/v0.6.0-rc.2-release-notes.md) | registry not checked as published in this cleanup; prep preserves `latest=0.5.0`, `next=0.6.0-rc.1`, and `alpha=0.3.9-alpha.8` until publish |

## Future Migration Notes

- Keep this file as the first stop for version/package chronology.
- Create full `docs/releases/v<version>/` capsules for older releases only when
  there is a current need to preserve or summarize that version in detail.
- Do not move old release-note files out of `docs/current/release/` without
  first preserving workflow compatibility or adding redirects.

## Claim Boundary

This index is a navigation aid. It does not add release evidence and does not
claim token/provider-token saving, product efficacy, navigation benefit, app
quality, full-TDD/test sufficiency, broad reliability, closure guarantee,
autonomous completion, generated-app certification, deterministic role
enforcement, production-ready delegation, or automatic
completion/downgrade/removal.
