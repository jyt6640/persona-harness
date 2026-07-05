# v0.6.0 Release Capsule

This capsule is the durable index for the published `0.6.0` stable release. It
complements the release-operation notes in
[`docs/current/release/v0.6.0-release-notes.md`](../../current/release/v0.6.0-release-notes.md).

## Channel State

- Published stable package: `persona-harness@latest=0.6.0`.
- Current published prerelease remains `persona-harness@next=0.6.0-rc.4`.
- Legacy `alpha` channel is retired after stable; explicit historical alpha
  versions remain installable by exact version.
- `persona-harness@0.6.0` resolves to gitHead
  `13b1f1b79884e2214c0b41a735b87cdd6d65ee00`, shasum
  `ffd77996263cffb858bd977edb73b03cf2820c75`, and integrity
  `sha512-0dY/LqXYuSD7/G/GsALoE0RBKClikt1MPVR6GvbXRieBiSDh5CEt0JNP0RxJ8Ur3howsURYeaFQX8aRhSzKP0A==`.
- Local and remote `v0.6.0` point to
  `13b1f1b79884e2214c0b41a735b87cdd6d65ee00`.
- GitHub release `v0.6.0` is stable: `isDraft=false`,
  `isPrerelease=false`.

## Durable Records

- [`release-facts.md`](release-facts.md): stable registry facts, included
  work, final package-runtime smoke, tester kickoff status, and release
  boundaries.
- [`measurements.md`](measurements.md): scoped HARDEN-1 and stable-cycle
  measurement summaries that govern this stable release.

## Stable Summary

`0.6.0` publishes the accepted HARDEN-1 line as stable after S-3 removed the
failed-finish human `Summary:` header that S-2 found non-inferior=false.

The stable release remains gate-first:

- deterministic finish/closure gates;
- PH-generated evidence and report-filled checks;
- read-only status/report surfaces;
- default-off continuation previews and explicit loop surfaces;
- no runtime-injection default movement.

## Post-Stable Tester Plan

This final stable record is the handoff point for external tester recruitment.
Recruitment is planned/ready to start; this capsule records no concrete
started-recruitment evidence. `PROJECT-PLAN.md` section 4 records the planned
post-stable external tester kickoff: 3-5 testers, with observation focused on
onboarding drop-off, first finish, doctor/feedback usage, user reaction to gate
blocks, team-convention demand, real gate-gaming incidents, and tester-driven
UX complaints.

HARDEN-2 may start only after this stable final record and tester kickoff
status are recorded, and it should yield to tester feedback during the
observation period.

## Boundaries

Do not use this release capsule to claim product efficacy,
token/provider-token saving, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic enforcement, production-ready
delegation, reliable automatic subagent orchestration, automatic
completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or broad
product behavior.
