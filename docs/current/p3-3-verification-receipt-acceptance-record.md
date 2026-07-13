# P3-3 Verification Receipt Candidate

Status: candidate branch only; QA and External re-gate required.

This unit defines the strict, versioned receipt and attempt boundary that a
future P3 fresh execution or external attestation path may use. It does not
issue receipts, verify signatures, or make any record finish authority.

## Contract

The read-only parser accepts only:

- `verification-receipt.1` records under
  `.persona/evidence/verification-receipts/`;
- `verification-attempt.1` records under
  `.persona/evidence/verification-attempts/`.

Records bind authority class, issuer verification state, receipt/attempt/session
and finish IDs, source HEAD, dirty-worktree digest, workspace identity,
command catalog and argv digest, PH version, result/test/artifact data,
timestamps, expiry, and provenance digest. Unknown fields, future schema
versions, invalid IDs/digests/timestamps, lifecycle contradictions, and
binding mismatches return structured diagnostics and fail closed.

Attempt states include started, completed, failed, interrupted, stale, expired,
and replayed. Duplicate IDs, repeated receipts for one attempt, older completed
attempts, expiry, and clock skew are diagnostic failure states. The latest
completed attempt is the only candidate considered for a matching receipt.

## Legacy Boundary

Existing `.persona/evidence` bearshell records, JUnit XML/TDD JSON, generated
markers, self-computed digests, arbitrary command/head/exit values, and stale
attempt identifiers remain diagnostic-only. P3-3 never infers missing fields,
rewrites legacy bytes, migrates legacy records, or creates a receipt from them.
Read-only assessment preserves malformed and legacy files.

Structurally valid local cooperative records and external-attestation-shaped
records are still reported as `untrusted` because issuer/signature/OIDC
verification and fresh execution do not exist in this unit. The P3-2
`trusted-authority-required` blocker therefore remains unchanged and finish
cannot pass from any project-local JSON.

## Deferred Work

P3-4 owns fresh fixed-command execution and issuance. Later work owns external
attestation verification, receipt migration policy, nonzero test enforcement,
and semantic TDD authority. This record makes no stable, GA, reliability,
efficacy, token-saving, or closure-guarantee claim.
