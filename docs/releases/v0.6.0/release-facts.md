# v0.6.0 Release Facts

## Pre-Publish State

`0.6.0` is prepared as the next stable package after the published
`0.6.0-rc.4` line. This is release prep only until QA publish GO.

- Prepared package version: `0.6.0`.
- Planned publish dist-tag after QA GO: `latest`.
- Current published stable remains `latest=0.5.0`.
- Current published prerelease remains `next=0.6.0-rc.4`.
- Alpha remains `alpha=0.3.9-alpha.8`.
- `persona-harness@0.6.0` should be unpublished before publish.
- No local or remote `v0.6.0` tag should exist before registry verification.

## Stable Decision Basis

The stable decision cycle S-0 through S-3 resolved the prior stable blocker:

- S-0 corrected the blocker: H1-6a compression NO-GO itself did not block
  stable; the shipped failed-finish human `Summary:` header's inferior
  real-session rail-entry evidence did.
- S-1 established `gate-fixture.2` with control rail entry `10/10`.
- S-2 regated the `Summary:` header: control `10/10`, candidate `9/10`, delta
  `-10pp`, non-inferiority false, decision
  `FAIL_RECOMMEND_HEADER_OFF_FOR_S3`.
- S-3 removed the failed-finish human `Summary:` header and QA/External
  accepted local-current package smoke at commit
  `c7affd7674fc949b373c414974b05010b8dd1f21`.

With the header off, failed `ph workflow finish implement` human stderr renders
`Required fixes:` directly. Detailed blocker diagnostics remain visible, and
`workflow closure next --json` remains the machine-readable next-step surface.

## Included Since `0.6.0-rc.4`

- `fdc2623`: S-1 `gate-fixture.2` record with control rail entry `10/10`.
- `d4cce82`: S-2 Summary-header regate record with candidate `9/10` vs control
  `10/10`, non-inferiority false.
- `c7affd7`: S-3 removal of the failed-finish human `Summary:` header.

## Stable HARDEN-1 Surface

- H1-1 records unmapped blocker de-loop and human escalation.
- H1-2 records mechanical finish regression coverage.
- H1-3 records deterministic blocker order and chain-depth contract.
- H1-4 records explicit block-level toolchain fail-closed behavior and mapped
  human guidance.
- H1-5 records atomic writes and fail-safe reads by migrated file family only.
- H1-6a repeated-output compression remains NO-GO and unimplemented.
- H1-6b structured required-fix data remains implementation support, but the
  failed-finish human `Summary:` header is not rendered.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview.
- Ralph-loop and `ph workflow loop` remain default-off/explicit surfaces; no
  default change is made.
- Stage 18 completion-integrity evidence remains fixture-scoped and does not
  prove broad product efficacy, reliability, app quality, token saving, or a
  default change.
- No `.persona/evidence` schema expansion is included.
- No OpenCode hook signature change is included.
- No gate exit-code or JSON schema field movement is included.
- No publish, tag, latest, next, or alpha dist-tag movement is included in this
  prep task.

## Tester Plan

`PROJECT-PLAN.md` section 4 makes stable the trigger for 3-5 external testers.
Tester observation should focus on onboarding drop-off, time to first finish,
doctor/feedback usage, user reaction to gate blocks, team-convention demand,
real fake-shim or gate-gaming incidents, and tester-driven UX complaints.

HARDEN-2 remains post-stable and can run during tester observation only while
yielding to tester feedback.

## No-claim Boundary

This is release-prep evidence and local verification, not registry evidence for
`0.6.0` until a future publish and External smoke cover the stable package. It
is not evidence for product efficacy, token/provider-token saving, navigation
benefit, app quality, full-TDD/test sufficiency, broad reliability, closure
guarantee, autonomous completion, generated-app certification, deterministic
enforcement, production-ready delegation, reliable automatic subagent
orchestration, automatic completion/downgrade/removal, CodeGraph/LSP
default/effectiveness, or broad product claims.
