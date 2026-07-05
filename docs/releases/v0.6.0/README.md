# v0.6.0 Release Capsule

This capsule is the durable index for the prepared `0.6.0` stable release. It
complements the release-operation notes in
[`docs/current/release/v0.6.0-release-notes.md`](../../current/release/v0.6.0-release-notes.md).

## Channel State

- Prepared package version: `0.6.0`.
- Planned publish channel after QA GO: npm `latest`.
- Current published stable remains `persona-harness@latest=0.5.0` until
  publish.
- Current published prerelease remains `persona-harness@next=0.6.0-rc.4`.
- Alpha channel remains `persona-harness@alpha=0.3.9-alpha.8`.
- `persona-harness@0.6.0` is expected to remain unpublished before the future
  publish step.
- No `v0.6.0` tag should exist before registry verification in the future
  publish/tag step.

## Durable Records

- [`release-facts.md`](release-facts.md): stable prep facts, included work,
  pre-publish channel state, and release boundaries.
- [`measurements.md`](measurements.md): scoped HARDEN-1 and stable-cycle
  measurement summaries that govern this release prep.

## Prep Summary

`0.6.0` prepares the accepted HARDEN-1 line for stable after S-3 removed the
failed-finish human `Summary:` header that S-2 found non-inferior=false.

The stable release remains gate-first:

- deterministic finish/closure gates;
- PH-generated evidence and report-filled checks;
- read-only status/report surfaces;
- default-off continuation previews and explicit loop surfaces;
- no runtime-injection default movement.

## Post-Stable Tester Plan

`PROJECT-PLAN.md` section 4 records the planned post-stable external tester
kickoff: 3-5 testers, with observation focused on onboarding drop-off, first
finish, doctor/feedback usage, user reaction to gate blocks, team-convention
demand, real gate-gaming incidents, and tester-driven UX complaints.

HARDEN-2 remains post-stable and should yield to tester feedback during that
observation period.

## Boundaries

Do not use this release capsule to claim product efficacy,
token/provider-token saving, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic enforcement, production-ready
delegation, reliable automatic subagent orchestration, automatic
completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or broad
product behavior.
