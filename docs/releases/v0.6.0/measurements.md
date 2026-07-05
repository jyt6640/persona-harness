# v0.6.0 Measurement Summary

This summary points to accepted measurement/status records that shape the
prepared `0.6.0` stable release. It does not replace append-only status files
under `docs/current/`.

## Stable Cycle S-0 through S-3

The stable blocker changed during S-0 and was resolved by S-3:

- S-0: H1-6a compression NO-GO itself did not block stable; the shipped
  failed-finish human `Summary:` header's inferior real-session rail-entry
  evidence did.
- S-1: `gate-fixture.2` restored control rail entry to `10/10`.
- S-2: Summary-header candidate rail entry was `9/10` versus control `10/10`,
  delta `-10pp`, non-inferiority false.
- S-3: the failed-finish human `Summary:` header was removed and local-current
  package smoke was accepted at commit
  `c7affd7674fc949b373c414974b05010b8dd1f21`.

This supports stable prep by removing the accepted regression source. It is not
a product efficacy, token saving, app quality, broad reliability, closure
guarantee, or default-change claim.

## H1-6a Compression

H1-6a repeated-output compression remains rejected and unimplemented. The real
precheck observed current/control rail entry `3/5`, Summary-header candidate
rail entry `1/5`, delta `-40pp`, and non-inferiority not met.

The compression candidate is not part of `0.6.0`.

## H1-6b Structured Required-Fix Data

H1-6b is accepted as structured required-fix data and internal implementation
support. The stable prep no longer renders the failed-finish human `Summary:`
header; `Required fixes:` and detailed blockers remain visible, and
`workflow closure next --json` remains the structured machine-readable path.

## H1-1 through H1-5 Hardening

- H1-1: unmapped blockers stop continuation loops and surface human
  configuration/maintainer escalation.
- H1-2: mechanical finish regression protects a finish-reachable
  Java/Spring-shaped fixture.
- H1-3: deterministic blocker order and current gate-chain depth contract are
  locked in tests.
- H1-4: explicit block-level ast-grep/toolchain-dependent conventions fail
  closed when the required toolchain is missing or fails; built-in warning
  conventions remain warnings.
- H1-5: atomic writes and fail-safe reads were split by file family, not a
  repo-wide all-writes guarantee.

## Stage 18 Fixture-Scoped Evidence

Stage 18 completion-integrity evidence remains fixture-scoped:

- OFF finish PASS `0/10`.
- Internal tool-output trigger finish PASS `10/10`, one-sided
  `p=0.0009765625`.
- External `ph workflow loop` finish PASS `7/10`, one-sided `p=0.0078125`,
  with `3/10` cap hits.

These results do not prove broad product efficacy, broad reliability, token
saving, app quality, or default-change readiness.

## Claim Boundary

None of the measurements above support product efficacy, token/provider-token
saving, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic enforcement, production-ready delegation, reliable
automatic subagent orchestration, automatic completion/downgrade/removal, or
CodeGraph/LSP default/effectiveness.
