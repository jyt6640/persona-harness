# P3-4 Fresh Fixed-Command Verifier Candidate

Status: candidate branch only; QA and External re-gate required.

## Provenance

- Base: `41bdf99e2523749df19208bcf8740b61db80c933`.
- Branch: `feat/fresh-fixed-command-verifier`.
- This record does not authorize P3-5 semantic TDD matching, external
  attestation, signer/OIDC verification, P3-6/P3-7 work, P2, or release use.

## Candidate Scope

- Existing `workflow finish implement --reverify [--ci]` now uses the fresh
  fixed POSIX Java/Spring/Gradle-wrapper runner already accepted for the
  reverification surface.
- A successful fresh run must observe at least one JUnit `<testcase>` across
  the post-start result references. A zero-test pass is converted to a
  nonzero failed result and does not issue a receipt.
- Successful fresh runs issue the existing P3-3
  `verification-attempt.1` and `verification-receipt.1` records with attempt,
  session, finish, source, dirty-worktree, workspace, catalog, argv, PH
  version, artifact, timestamp, expiry, and provenance bindings.
- Failed fresh runs may retain a failed attempt record but never issue a pass
  receipt. Existing digest-only `ph-ci-reverification.1` artifacts remain
  bounded and redacted.
- Local receipts are `local-fresh-cooperative` and
  `cooperative-unverified`. P3-2 therefore continues to classify them as
  untrusted and `trusted-authority-required`; this candidate does not create a
  finish PASS or bypass the authority gate.

## Boundaries

Legacy bearshell output, JUnit/TDD files, generated markers, self-computed
digests, arbitrary command/head/exit values, and stale records remain
diagnostic-only. No default, configuration, new schema, runtime hook, external
attestation, signer/OIDC verification, semantic TDD matcher, version, release,
tag, publish, P2, or stable/GA claim is included.
