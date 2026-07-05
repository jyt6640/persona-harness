# v0.6.0-rc.4 Release Capsule

This capsule is the durable index for the `0.6.0-rc.4` release-prep line. It
complements the release-operation notes in
[`docs/current/release/v0.6.0-rc.4-release-notes.md`](../../current/release/v0.6.0-rc.4-release-notes.md).

## Channel State

- Release-prep package version: `0.6.0-rc.4`.
- Planned publish channel: npm `next`.
- This prep is not published or tagged.
- Current published prerelease remains `persona-harness@next=0.6.0-rc.3`.
- Stable channel remains `persona-harness@latest=0.5.0`.
- Alpha channel remains `persona-harness@alpha=0.3.9-alpha.8`.
- Published `0.6.0-rc.3` registry gitHead:
  `e1af520cf000e805e7df6a1616906f3f9b0e4976`.
- Published `0.6.0-rc.3` registry shasum:
  `ef498adfac138d9d0843406cba53acf76b34c6f1`.

## Durable Records

- [`release-facts.md`](release-facts.md): prep facts, included commits,
  stable deferral, and release boundaries.
- [`measurements.md`](measurements.md): scoped HARDEN-1 measurement and probe
  summaries that govern this release prep.

## Prep Summary

`0.6.0-rc.4` prepares accepted HARDEN-1 work after the published rc3 line:

- H1-0 preflight PARTIAL and Stage 18 tokens-per-verified-completion telemetry.
- H1-1 blocker-step contract and unmapped-blocker human escalation.
- H1-3 deterministic blocker order and chain-depth contract.
- H1-2 mechanical finish regression coverage.
- H1-4 block-level toolchain fail-closed behavior and mapped human guidance.
- H1-5 atomic writes and fail-safe reads by file family.
- H1-6a real precheck failure, leaving compression NO-GO and unimplemented.
- H1-6b structured finish summary derivation.

Stable `0.6.0` remains deferred because H1-6a failed the real rail-entry gate
and no waiver exists. This capsule is prerelease-prep documentation, not
registry evidence.

## Boundaries

Do not use this release-prep capsule to claim product efficacy,
token/provider-token saving, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic enforcement, production-ready
delegation, reliable automatic subagent orchestration, automatic
completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or broad
product behavior.
