# P3 Integrity Roadmap

Status: accepted P3-0 roadmap with a later P3-9 exact-main governance decision.
P2 source-only investigation may resume only under the P3-9 boundary; P2
product/release use and strong release claims remain held.

Baseline for this record: `633b4bca4bc7b7292f37ac109c8028df1385a9ae`.

Local audit inputs:

- Report: `/Users/yongtae/Downloads/persona-harness-production-audit.md`
- Execution log: `/Users/yongtae/Downloads/persona-harness-audit-execution-log.txt`

These files are local audit evidence for release planning. They are not a
published third-party certification, and this record does not claim that the
audit independently verifies a fixed product state.

## Accepted Decision

Stable/GA and npm `latest` movement are NO-GO until P3 closes. The current
`0.7.0-rc.2` next-channel evidence remains a pilot/release-candidate record,
not a basis for strong completion-integrity, security, certification, broad
reliability, app-quality, token-saving, or enforcement claims.

The current completion authority can block defined missing-report and bounded
fixture violations, but it must not be described as blocking all forged or fake
evidence. The audit records bypasses in the published `0.7.0-rc.2` package:
project-local evidence can be fabricated consistently enough for current
closure paths, malformed config can fail open, path interpretation can split,
zero-test verification can pass, and traversal can fail with an unhandled
symlink cycle. These findings block strong integrity claims until remediated.

## P2 Resumption Boundary

Completed P2 source-only evidence, branches, and bundles are retained. They are
retained, not discarded.

The P3-9 decision permits only separately authorized P2 source, measurement, or
report-only investigation with isolated provenance and independent QA and
External gates. Except for the narrow #19 exception below, do not integrate,
publish, release, enable by default, or use P2 work as product, adoption,
stable, GA, or npm `latest` evidence.

See [`p3-9-rc3-integrity-governance-decision.md`](p3-9-rc3-integrity-governance-decision.md)
for the exact-main decision and its release boundary.

The sole user-authorized product-scope exception is issue #19 Korean CLI help
locale selection, recorded in
[`korean-cli-help-scope-authorization.md`](korean-cli-help-scope-authorization.md).
It does not authorize a default change, other P2 product work, or any release
claim.

## Assurance Model

P3 uses a two-level assurance model.

Level 1: local fresh fixed-command verification. PH must execute the
project-profile/catalog-selected verification command itself at finish time and
bind the result to the workspace, source, command catalog, PH version, and
attempt identity. This protects against stale or unsigned project-artifact reuse
inside a cooperative project. It is not a hostile same-user filesystem,
malicious toolchain, or signed external attestation guarantee.

Level 2: trusted external signed CI/verifier attestation. Strong integrity,
GA, stable, or npm `latest` claims require an attestation issued by a trusted
external verifier with signature/provenance and replay protection. This level is
not equivalent to unsigned project-local JSON, and P3 must not collapse the two.

Unsigned project-local JSON may remain useful diagnostics and audit material.
It is not finish authority.

## Evidence And Attestation Contract

Accepted P3 direction:

- Issuer: finish authority must come from PH fresh local execution or a trusted
  external verifier; artifact JSON written only by a project process is
  untrusted unless backed by the accepted authority.
- Signature and provenance: external attestation requires a verifier identity,
  signature, issuer metadata, source repository/ref, and verified run context.
- Source binding: record source `HEAD`, dirty-worktree digest, and whether the
  source state was clean, dirty, missing, or unavailable.
- Workspace binding: record workspace root realpath identity plus device and
  inode when available; equality is checked across the attempt.
- Command binding: record fixed argv/catalog identifier and catalog version;
  free-form command text is not authority.
- PH binding: record PH package version and command surface that produced or
  consumed the result.
- Attempt identity: record attempt ID, session ID, finish ID, started/completed
  timestamps, and latest-completed-attempt semantics.
- Artifact binding: record artifact digest, artifact schema version, byte size,
  and strict reread/validation result.
- Expiry and replay: record issuance and expiry. Reject expired, replayed,
  duplicate, mismatched, stale, failed, interrupted, or superseded attempts.
- State labels: every consumed evidence item must be explicitly trusted,
  untrusted-diagnostic, stale, malformed, failed, interrupted, unavailable, or
  ignored.
- Completion rule: only the latest completed trusted attempt for the current
  source/workspace/command identity can satisfy finish authority.

Malformed, missing, stale, failed, interrupted, duplicate, or unsigned evidence
must fail closed for finish authority. It may still be retained for diagnostics.

## Semantic TDD Requirements

P3 TDD authority requires an observed real red-to-green chain:

- Red: a real PH-run fixed verification command exits nonzero and JUnit reports
  at least one failing testcase for the defined test identity.
- Green: a later PH-run fixed verification command exits zero and JUnit reports
  pass for the same defined test identity.
- Nonzero test count is mandatory. Zero tests must fail closure.
- Parameterized tests must preserve a stable test identity or map through an
  explicit deterministic identity rule.
- Renamed tests require an explicit identity migration record; otherwise the
  chain is broken.
- Skipped, disabled, no-source, up-to-date-without-observed-results, missing
  JUnit, malformed JUnit, or source-change ambiguity cannot satisfy red or
  green authority.
- A source change between red and green is allowed only when the source identity
  transition is recorded and belongs to the same ticket/attempt chain.

## Config, Path, And Walker Safety

Malformed config must fail closed. `ph doctor` may report read-only diagnostics,
but it must not silently repair, delete, clean, overwrite, or invent defaults for
finish authority.

Recovery must be explicit and transactional. It must preserve corrupt bytes in a
backup or recovery record before writing replacement material.

P3 requires one canonical resolved path model for evidence and rules. Closure,
doctor, init/attach, archive, and finish must consume the same resolved
project-local paths.

Traversal rules:

- Use `lstat` before traversal and do not follow symlinks.
- Bound depth, file count, total bytes, per-file bytes, binary detection, and
  unreadable-file handling.
- Treat unreadable, symlinked, too-deep, too-large, or malformed evidence as
  explicit failure/diagnostic states, not implicit success.

## Init Upgrade Safety

P3 init upgrade must use managed-block ownership semantics. User-authored files
are preserved by default.

Accepted behavior:

- Detect managed blocks and ownership before writing.
- Preserve unowned user content.
- On conflict, stop with diagnostics unless an explicit force mode is accepted
  in that tranche.
- If force is accepted, create a backup and perform a transactional write.
- Roll back on failed write or failed post-write validation.
- Never silently overwrite existing user config, rules, or docs.

## CI And Release Constraints

Before any stable/GA or npm `latest` movement, P3 requires:

- PR and main CI for tests, build, docs checks, package policy, and accepted
  integrity regressions.
- Repository ruleset or equivalent main protection.
- Safe fork permissions and no `pull_request_target` secret exposure for
  untrusted code.
- Pinned actions or pinned trusted action references.
- Protected publish environment.
- Publish only from exact accepted version, tag, ref, and main ancestry.
- No arbitrary `workflow_dispatch` ref publishing.
- Registry readback for version, dist-tag, shasum/integrity, gitHead, and
  package contents.
- A new RC3 validation cycle before any npm `latest` move.

## Security-Red Mechanics

Adversarial reproductions are archived and converted into regression fixtures.
They may be merged to main only with the fix that makes the regression green.

Knowingly failing security tests must not be left on main as permanent red
tests. A P3 implementation branch may carry a red-first commit for review only
when the terminal accepted branch makes the regression green before main
integration.

## Acceptance Units

P3 is split into narrow units:

1. P3-0 canonical claims/freeze: this record, public claim narrowing, P2 hold,
   and roadmap/index wiring.
2. P3-1 adversarial regression fixture harness for the audit reproductions.
3. P3-2 closure authority policy with no unsigned project-artifact fallback.
4. P3-3 attempt/receipt/attestation schema and migration.
5. P3-4 fresh fixed-command runner, including nonzero test-count enforcement.
6. P3-5 semantic TDD red-to-green chain.
7. P3-6 config/path/walker safety.
8. P3-7 safe init upgrade.
9. P3-8 CI/publish/release-ref restrictions.
10. P3-9 RC3 validation and P2-resumption decision.

## Remaining Gates

- P3-1 through P3-8 and the P3-9 exact-main validation are recorded in their
  accepted current decision records.
- P2 resumes only inside the constrained P3-9 source-only boundary.
- Stable, GA, and npm `latest` require a separate actual RC3 release cycle,
  exact tag/version/main ancestry, registry readback, and the Level 2 trusted
  external attestation boundary.

## Boundaries

This record is docs-only. It does not implement P3, change product behavior,
change defaults, change schemas, change versions, publish a package, move tags
or dist-tags, start P2 work, or claim that completion integrity is fixed.

Runtime injection remains default-off. No generated-app certification,
token-saving, app-quality, broad reliability, hostile-workspace security,
automatic delegation, or broad enforcement claim is made.
