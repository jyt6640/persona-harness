# Package Version Index

This index is the human-readable package/version timeline for Persona Harness.
It is based on repo-local evidence: `CHANGELOG.md`, release-note files under
`docs/current/release/`, existing versioned capsules, package metadata, local
git tags, and explicitly recorded registry smoke facts.

Use this index to scan package history. Use the linked release notes,
`CHANGELOG.md`, and version capsules for detailed evidence.

## Live Release Lookup

This package-visible index is a historical timeline, not a live dist-tag
ledger. Read [live npm versions and dist-tags](https://www.npmjs.com/package/persona-harness?activeTab=versions)
and [live GitHub Releases](https://github.com/jyt6640/persona-harness/releases)
before making a release decision. The timeline below preserves older channel
values in their historical rows; they are not competing live claims.

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
| `0.3.9-alpha.8` | 2026-06-29 | historical alpha; local tag exists; exact version remains installable after `alpha` dist-tag retirement | [`release notes`](../current/release/v0.3.9-alpha.8-release-notes.md) | T0 cleanup confirmed exact `persona-harness@0.3.9-alpha.8` still resolves with gitHead `3bb90aa50c8d1231189a5ca00665e8d5bfccade9` and shasum `cd26989425223b5145f190c2dfbfa5ad84e57cf9` |
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
| `0.5.0` | 2026-07-03 | historical stable `latest`; local tag exists | [`release notes`](../current/release/v0.5.0-release-notes.md) | release notes record `latest=0.5.0`, gitHead, shasum, Trusted Publisher/Release workflow runs, and External stable registry smoke archive |
| `0.6.0-rc.1` | 2026-07-03 | historical published `next` RC; local tag exists | [`capsule`](v0.6.0-rc.1/README.md), [`release facts`](v0.6.0-rc.1/release-facts.md), [`measurements`](v0.6.0-rc.1/measurements.md), [`release notes`](../current/release/v0.6.0-rc.1-release-notes.md) | capsule records `next=0.6.0-rc.1`, `latest=0.5.0`, `alpha=0.3.9-alpha.8`, gitHead, shasum, tag, and Stage 14 registry smoke archive |
| `0.6.0-rc.2` | 2026-07-04 | previous published `next` RC; local tag exists | [`capsule`](v0.6.0-rc.2/README.md), [`release facts`](v0.6.0-rc.2/release-facts.md), [`measurements`](v0.6.0-rc.2/measurements.md), [`release notes`](../current/release/v0.6.0-rc.2-release-notes.md) | registry smoke records `next=0.6.0-rc.2`, `latest=0.5.0`, `alpha=0.3.9-alpha.8`, gitHead `d3d5fdced355f0ac0fbed5e700d57b2aa1592263`, shasum `0eae3cc232e3f37de9390b0afc662a001aaa0b56`, tag, and archive `rc060-rc2-registry-smoke-20260704T043901Z` |
| `0.6.0-rc.3` | 2026-07-04 | previous published `next` RC; local tag exists | [`capsule`](v0.6.0-rc.3/README.md), [`release facts`](v0.6.0-rc.3/release-facts.md), [`measurements`](v0.6.0-rc.3/measurements.md), [`release notes`](../current/release/v0.6.0-rc.3-release-notes.md) | registry smoke records `next=0.6.0-rc.3`, `latest=0.5.0`, `alpha=0.3.9-alpha.8`, gitHead `e1af520cf000e805e7df6a1616906f3f9b0e4976`, shasum `ef498adfac138d9d0843406cba53acf76b34c6f1`, tag, prerelease GitHub release, and archive `rc060-rc3-registry-smoke-20260704T133936Z` |
| `0.6.0-rc.4` | 2026-07-05 | historical published `next` RC; local tag exists | [`capsule`](v0.6.0-rc.4/README.md), [`release facts`](v0.6.0-rc.4/release-facts.md), [`measurements`](v0.6.0-rc.4/measurements.md), [`release notes`](../current/release/v0.6.0-rc.4-release-notes.md) | registry smoke records `next=0.6.0-rc.4`, `latest=0.5.0`, `alpha=0.3.9-alpha.8`, gitHead `cf6835697f47da5a2a8372d00fc47e263ee781f8`, shasum `76565f6e7d244595fa338bb646ea7888d8d5255a`, integrity `sha512-8oBVX1vmudoNZCJEVXNdx/lJnPITKD0cW2OGk6Bv963oibNwyo+itxYquRNr8JlDQR7RKDmcQ5XTCVlIP9weaw==`, tag, prerelease GitHub release, and archive `rc060-rc4-registry-smoke-20260705T110131Z` |
| `0.6.0` | 2026-07-05 | historical stable `latest`; local tag exists | [`capsule`](v0.6.0/README.md), [`release facts`](v0.6.0/release-facts.md), [`measurements`](v0.6.0/measurements.md), [`release notes`](../current/release/v0.6.0-release-notes.md) | registry smoke records `latest=0.6.0`, `next=0.6.0-rc.4`, `alpha=0.3.9-alpha.8` at smoke time, gitHead `13b1f1b79884e2214c0b41a735b87cdd6d65ee00`, shasum `ffd77996263cffb858bd977edb73b03cf2820c75`, integrity `sha512-0dY/LqXYuSD7/G/GsALoE0RBKClikt1MPVR6GvbXRieBiSDh5CEt0JNP0RxJ8Ur3howsURYeaFQX8aRhSzKP0A==`, stable GitHub release, and archive `stable-060-registry-smoke-20260705T041031Z`; later T0 cleanup removed the `alpha` dist-tag |
| `0.7.0-rc.1` | 2026-07-11 | published `next` prerelease; matching tag and release branch | [`capsule`](v0.7.0-rc.1/README.md), [`release facts`](v0.7.0-rc.1/release-facts.md), [`measurements`](v0.7.0-rc.1/measurements.md), [`release notes`](../current/release/v0.7.0-rc.1-release-notes.md) | registry gitHead/tag/release branch `d4d4d9a`; npm SHA-1 `5a15c8c15abc5169a4843cbe41d12ec481793f3b`; `latest=0.6.0`, `next=0.7.0-rc.1` |
| `0.7.0-rc.2` | 2026-07-12 | published `next` prerelease; matching tag and GitHub prerelease | [`capsule`](v0.7.0-rc.2/README.md), [`release facts`](v0.7.0-rc.2/release-facts.md), [`measurements`](v0.7.0-rc.2/measurements.md), [`release notes`](../current/release/v0.7.0-rc.2-release-notes.md) | workflow `29184360718`; registry gitHead `185885b`; SHA-1 `0d5595b697694c54ece6adfd8c5e8e77f3c2f3e3`; `latest=0.6.0`, `next=0.7.0-rc.2` |
| `0.7.0-rc.3` | 2026-07-14 | published `next` prerelease; matching tag and GitHub prerelease | [`capsule`](v0.7.0-rc.3/README.md), [`release facts`](v0.7.0-rc.3/release-facts.md), [`measurements`](v0.7.0-rc.3/measurements.md), [`release notes`](../current/release/v0.7.0-rc.3-release-notes.md) | workflow `29310969744`; registry gitHead `728e9c3`; SHA-1 `9d1fb27ab86d344afcd748b66959188ea9553258`; `latest=0.6.0`, `next=0.7.0-rc.3` |
| `0.8.0-beta.1` | 2026-07-24 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.1-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | exact registry install and staged provenance passed; it does not establish current-version consumer authority or Finish authority |
| `0.8.0-beta.2` | 2026-07-26 | immutable Consumer Authority Beta staging-only NO-GO evidence | [`release notes`](../current/release/v0.8.0-beta.2-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | registry/provenance evidence cannot substitute for the missing full public Java/Spring consumer lifecycle or current-version original signed artifact |
| `0.8.0-beta.3` | 2026-07-26 | immutable Consumer Authority Beta staging-only NO-GO evidence | [`release notes`](../current/release/v0.8.0-beta.3-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | registry/package and artifact transport evidence cannot substitute for a completed public Finish, current-version consumption/replay proof, or independent online custom-predicate verification |
| `0.8.0-beta.5` | 2026-07-27 | Consumer Authority Beta source preparation | [`release notes`](../current/release/v0.8.0-beta.5-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | strict staging-only prerelease source candidate; requires public Java/Spring test and compile lifecycle with bounded source-read evidence, tag-bound publish/readback, current-version original signed artifact, and independent consumer verification |
| `0.8.0-beta.6` | 2026-07-27 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.6-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | prior registry/package evidence cannot satisfy beta.12 current-version cooperative, original-artifact, consumption, replay, or independent verification requirements |
| `0.8.0-beta.7` | 2026-07-29 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.7-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | the structurally bound original artifact missed independent online verification inside its leaf certificate window; it is not reusable current-version authority evidence |
| `0.8.0-beta.8` | 2026-07-29 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.8-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | original artifact verification passed, but an obsolete caller workflow prearm retained no authority artifact; it cannot satisfy beta.12 current-version discovery, consumption, replay, or independent verification requirements |
| `0.8.0-beta.9` | 2026-07-29 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.9-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | original artifact verification passed, but the installed fetch expanded the enrolled workflow filename into a repository path and retained no authority artifact; it cannot satisfy beta.12 current-version discovery, consumption, replay, or independent verification requirements |
| `0.8.0-beta.10` | 2026-07-29 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.10-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | original bytes and independent online crypto passed, but the isolated External consumer lacked a usable GitHub read credential for installed authority discovery; it cannot satisfy beta.12 current-version authority, consumption, or replay requirements |
| `0.8.0-beta.11` | 2026-07-30 | historical Consumer Authority Beta source preparation | [`release notes`](../current/release/v0.8.0-beta.11-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | observer credential pre-arm did not establish a verified isolated observer condition before fixture authorization; it supplies no reusable artifact, authority, consumption, or replay evidence |
| `0.8.0-beta.12` | 2026-07-30 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.12-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | original artifact, online crypto, and installed fetch preparation passed, but public Finish retained readiness blockers; it is not reusable beta.13 authority, consumption, or replay evidence |
| `0.8.0-beta.13` | 2026-07-30 | Consumer Authority Beta source preparation | [`release notes`](../current/release/v0.8.0-beta.13-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | strict staging-only prerelease source candidate; its public Java/Spring readiness route must reach only `trusted-authority-required` before a natural current-version artifact can be authorized for online verification, installed fetch, explicit consumption, and replay rejection |
| `0.8.0-beta.17` | 2026-08-02 | historical Consumer Authority Beta source preparation | [`release notes`](../current/release/v0.8.0-beta.17-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | canonical tar and provenance were created, but the Node20/npm10 registry PUT was authorization-shaped; it is not a package-absence or authority fact |
| `0.8.0-beta.18` | 2026-08-02 | immutable Consumer Authority Beta staging evidence | [`release notes`](../current/release/v0.8.0-beta.18-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | registry bytes matched canonical facts, but an unsupported registry gitHead predicate blocked workflow readback; it is not reusable lifecycle evidence |
| `0.8.0-beta.19` | 2026-08-02 | Consumer Authority Beta source preparation | [`release notes`](../current/release/v0.8.0-beta.19-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | workflow-bound canonical source to registry-byte reconciliation with one fresh hosted registry PUT/readback residual |
| `0.8.0-beta.22` | 2026-08-02 | historical Consumer Authority Beta procedure evidence | [`release notes`](../current/release/v0.8.0-beta.22-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | host gh/XDG state created an untracked `.local` entry after the final commit; it supplies no reusable final evidence |
| `0.8.0-beta.23` | 2026-08-03 | Consumer Authority Beta v3 procedure-only source preparation | [`release notes`](../current/release/v0.8.0-beta.23-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | all fifteen host-state roots are outside the consumer realpath, with same CWD/HEAD/source and empty Git cleanliness checks after every pre-push stage |
| `0.8.0-beta.34` | 2026-08-09 | published staging-only beta | [`release notes`](../current/release/v0.8.0-beta.34-release-notes.md), [`beta lifecycle`](../current/release/consumer-authority-beta.md) | recorded npm `staging` at the 2026-08-09 readback; staging evidence is not Finish or promotion authority |
| `0.8.0-rc.1` | 2026-08-09 | published `next` release candidate | [`release notes`](../current/release/v0.8.0-rc.1-release-notes.md) | recorded npm `next` at the 2026-08-09 readback |
| `0.8.0` | 2026-08-09 | published stable release | [`release notes`](../current/release/v0.8.0-release-notes.md) | superseded as npm `latest` by `0.8.1` in the same release cycle |
| `0.8.1` | 2026-08-09 | historical stable `latest` record | [`release notes`](../current/release/v0.8.1-release-notes.md) | superseded as npm `latest` by the later recorded `0.8.2` publication; re-read live state before a release decision |
| `0.8.2` | 2026-08-10 | recorded npm `latest` publication | [`release notes`](../current/release/v0.8.2-release-notes.md) | canonical registry bytes are immutable and cannot supply `0.8.3` or later package evidence |
| `0.8.3` | 2026-08-10 | published stable release; immutable historical record | [`release notes`](../current/release/v0.8.3-release-notes.md) | package bytes and acceptance evidence are fixed to 0.8.3 and cannot be reused for later package-visible corrections |
| `0.8.4` | 2026-08-11 | unpublished stable source candidate | [`release notes`](../current/release/v0.8.4-release-notes.md) | adds the normalized authority binding-reason contract; requires its own exact package facts and normal package and hosted gates |
| `0.8.24` | 2026-08-22 | published stable release | [`release notes`](../current/release/v0.8.24-release-notes.md) | protected CI, immutable tag, stable GitHub Release, npm `latest`, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |
| `0.8.25` | 2026-08-22 | published stable release | [`release notes`](../current/release/v0.8.25-release-notes.md) | release-truth contract, protected CI, immutable tag, stable GitHub Release, npm publication, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |
| `0.8.26` | 2026-08-22 | published stable release | [`release notes`](../current/release/v0.8.26-release-notes.md) | package-visible live lookup, protected CI, immutable tag, stable GitHub Release, npm publication, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |
| `0.8.27` | 2026-08-24 | published stable release | [`release notes`](../current/release/v0.8.27-release-notes.md) | protected CI, immutable tag, stable GitHub Release, npm publication, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |
| `0.8.28` | 2026-08-24 | published stable release | [`release notes`](../current/release/v0.8.28-release-notes.md) | protected CI, immutable tag, stable GitHub Release, npm publication, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |
| `0.8.29` | 2026-08-24 | published stable release | [`release notes`](../current/release/v0.8.29-release-notes.md) | protected CI, immutable tag, stable GitHub Release, npm publication, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |
| `0.8.30` | 2026-08-25 | published stable release | [`release notes`](../current/release/v0.8.30-release-notes.md) | protected CI, immutable tag, stable GitHub Release, npm publication, canonical tar reconciliation, and provenance readback were recorded; these immutable facts cannot authorize a later package |

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
