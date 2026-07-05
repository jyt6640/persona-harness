# v0.6.0-rc.4 Release Capsule

This capsule is the durable index for the published `0.6.0-rc.4` prerelease. It
complements the release-operation notes in
[`docs/current/release/v0.6.0-rc.4-release-notes.md`](../../current/release/v0.6.0-rc.4-release-notes.md).

## Channel State

- Published package version: `0.6.0-rc.4`.
- Published channel: npm `next`.
- Current published prerelease is `persona-harness@next=0.6.0-rc.4`.
- Stable channel remains `persona-harness@latest=0.5.0`.
- Alpha channel remains `persona-harness@alpha=0.3.9-alpha.8`.
- Published `0.6.0-rc.4` registry gitHead:
  `cf6835697f47da5a2a8372d00fc47e263ee781f8`.
- Published `0.6.0-rc.4` registry shasum:
  `76565f6e7d244595fa338bb646ea7888d8d5255a`.
- Published `0.6.0-rc.4` registry integrity:
  `sha512-8oBVX1vmudoNZCJEVXNdx/lJnPITKD0cW2OGk6Bv963oibNwyo+itxYquRNr8JlDQR7RKDmcQ5XTCVlIP9weaw==`.

## Durable Records

- [`release-facts.md`](release-facts.md): prep facts, included commits,
  stable deferral, and release boundaries.
- [`measurements.md`](measurements.md): scoped HARDEN-1 measurement and probe
  summaries that govern this release prep.

## Prep Summary

`0.6.0-rc.4` publishes accepted HARDEN-1 work after the published rc3 line:

- H1-0 preflight PARTIAL and Stage 18 tokens-per-verified-completion telemetry.
- H1-1 blocker-step contract and unmapped-blocker human escalation.
- H1-3 deterministic blocker order and chain-depth contract.
- H1-2 mechanical finish regression coverage.
- H1-4 block-level toolchain fail-closed behavior and mapped human guidance.
- H1-5 atomic writes and fail-safe reads by file family.
- H1-6a real precheck failure, leaving compression NO-GO and unimplemented.
- H1-6b structured finish summary derivation.

Stable `0.6.0` remains deferred because H1-6a failed the real rail-entry gate
and no waiver exists.

## Registry Smoke

Accepted archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc060-rc4-registry-smoke-20260705T110131Z`.

The smoke installed `persona-harness@next` from npm registry only; no local
tarball evidence was used. It verified registry install/version/help, failed
finish and repeated finish, closure JSON, H1-4 mapped toolchain path, H1-1
unmapped path, representative H1-5 atomic/corrupt-state behavior, H1-6b
structured finish summary ordering, and retained rc3 workflow-loop,
ralph-loop, and Role Checklist Relay surfaces.

The smoke did not make H1-5 a full repeat of every atomic-write family.
Initial H1-4/H1-1 fixtures had prerequisite blockers ahead, so isolated
populated reruns were used to put target blockers first.

## Boundaries

Do not use this release capsule to claim product efficacy,
token/provider-token saving, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic enforcement, production-ready
delegation, reliable automatic subagent orchestration, automatic
completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or broad
product behavior.
