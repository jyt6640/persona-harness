# v0.7.0-rc.1 Measurement And Observation Summary

This summary carries forward accepted, scoped observations relevant to the
candidate. It does not convert them into a release-wide quality or reliability
claim.

## Java Precision Warnings

Item 21 accepted three Java/Spring conventions as high-precision `warn`
surfaces only: raw generic types, exact unsafe `Optional` chains, and mutable
static fields. Configured block attempts demote to warn and create no closure
blocker.

The separately accepted attendance observation recorded zero false positives
for its bounded observation scope. It is not a precision-rate estimate, a
general no-false-positive promise, or authorization to promote warnings to
blocks.

## CI Evidence Reverification

Item 19 accepted a fresh PH-owned reverification attempt for local
`--reverify` and explicit CI `--reverify --ci`. The catalog is POSIX
Java/Spring/Gradle only, runs fixed no-shell wrapper argv with 120-second
per-command and 300-second attempt bounds, and records a structurally redacted
artifact capped at 256 KiB.

CI tracked source/config mutations outside `build/**` and `.gradle/**`, or
post-command identity mismatch, are `partial` under the documented precedence.
Local mutation observation is report-only by default. This is a bounded
workflow gate contract, not CI correctness, security, or broad reliability
evidence.

## Existing Measurement Boundaries

The candidate does not remeasure or change the accepted LEAN, rail-entry,
ralph-loop, or workflow-loop status records. In particular, no token-saving,
provider-token-saving, default-change, completion-guarantee, or app-quality
claim is added.

## Claim Boundary

All observations here remain tied to their original fixtures, local-current
package smokes, or accepted design/implementation records. They do not certify
generated applications, generalized Java quality, broad enforcement, or
multi-language support.
