# Korean CLI Help Scope Authorization

## Status

Accepted by explicit user instruction on 2026-07-14.

## Decision

Issue [#19](https://github.com/jyt6640/persona-harness/issues/19),
`Feature: support Korean CLI help locale`, is authorized as the sole
product-scope exception to the P3-9 P2 source-only resumption boundary.

The exception permits a fresh current-main implementation and review of Korean
CLI help locale selection. It does not reopen P2 product work generally.

## Allowed Scope

- Discover the current CLI help and locale behavior from exact current main.
- Implement Korean CLI help locale selection under issue #19.
- Add directly related tests, documentation, and installed-package manual QA.
- Deliver the change through exact provenance, independent QA, fresh External
  installed-package smoke, strict PR CI, and protected-main merge.

## Preserved Boundaries

- Existing default help behavior remains unchanged unless a later accepted
  decision explicitly authorizes a default change.
- No workflow-finish authority, trusted-attestation, receipt, or closure
  authority behavior changes are authorized.
- No other P2 product/runtime work is authorized by this record.
- No schema, package version, release, tag, dist-tag, registry, npm publish,
  Stable, GA, or npm `latest` movement is authorized.
- Historical P2 branches remain reference material only. They must not be
  cherry-picked, rebased, or treated as current acceptance evidence.

## Required Evidence

The issue #19 candidate must record exact current-main provenance, use a
functional branch and PR title, and pass focused tests, typecheck, build, a
fresh installed-package smoke, and manual CLI help behavior checks. The
candidate requires separate QA and External PASS before protected integration.

## Claims

This authorization permits implementation work only. It does not claim
reliability, adoption, security certification, release readiness, Stable, GA,
or npm `latest` readiness.
