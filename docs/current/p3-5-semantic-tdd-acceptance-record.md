# P3-5 Semantic TDD Red-to-Green Candidate

Status: candidate branch only; QA and External re-gate required.

## Provenance

- Base: `c03b81db09e31d36f1873459891886ae13771409`.
- Branch: `feat/semantic-tdd-red-green`.
- This record does not authorize P3-6/P3-7 work, P2, signer/OIDC
  verification, external attestation, release use, or a finish PASS.

## Candidate Scope

- A read-only semantic assessor now recognizes only a fresh P3-4 fixed-command
  red-to-green chain. The red phase must be a nonzero fixed `test` execution
  with a real JUnit failure and one unambiguous testcase identity.
- The later green phase must be a fresh fixed `test` plus `build` execution,
  exit successfully, report a nonzero JUnit testcase count, and contain a
  passing testcase with the same identity. Red must precede green.
- Both phases must bind to the current Java/Spring/Gradle catalog and exact
  command plan, profile, source head, dirty-worktree digest, workspace
  identity, PH version, finish/session lineage, attempt identity, artifact
  digest, and provenance digest. Duplicate, replayed, stale, expired,
  malformed, mismatched, zero-test, mutable-overwritten, or legacy-only
  evidence fails closed.
- Green may contain additional passing testcases; only the red testcase
  identity is selected. A mutable JUnit path that overwrites red evidence is
  rejected rather than treated as a red-to-green chain.
- The semantic assessment is surfaced as diagnostic context in the existing
  finish authority blocker. A structurally valid local chain remains
  `untrusted`; P3-2 still returns `trusted-authority-required`.

## Verification Boundary

Focused synthetic regressions cover valid red-to-green structure, green without
red, ordering, testcase/source/provenance/command-plan mismatch, duplicate and
expired records, zero-test green, mutable JUnit output, forged legacy fields,
additional green tests, missing JUnit failure evidence, read-only assessment,
and the unchanged finish blocker. These are structural/security regressions,
not product efficacy, test-sufficiency, reliability, token, or completion
claims.

No signer/OIDC or external authority verification, fixed-command redesign,
zero-test weakening, runtime hook, default/config/schema/version/release
movement, P2 work, or stable/GA claim is included. Local receipts and all
legacy bearshell/JUnit/TDD/digest files remain diagnostic-only until a future
trusted authority path exists.
