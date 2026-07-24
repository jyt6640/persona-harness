# Consumer Authority V1 Decision

Status: Issue #108 defined this source decision. Issue #113 implements the
explicit-only, current-process cooperative Finish path described here. It does
not add external authority, a receipt, a release action, or a durable Finish
terminal record.

## Decision

V1 separates two assurance modes:

- The existing default remains external evidence or a blocked result. Missing,
  unavailable, malformed, expired, replayed, or mismatched external evidence
  remains blocked.
- `ph workflow finish implement --assurance cooperative` may consume a
  same-invocation cooperative runner once after its fixed Gradle verification
  succeeds. This explicit mode never falls back from external assurance.
- A later `--require external` mode remains strict and accepts only the
  external evidence path. This flag is not implemented by this record.

No local receipt, JUnit report, TDD record, digest, generated marker, or
caller-supplied JSON becomes authority through this decision.

## Typed Model Boundary

The Issue #109 implementation records `diagnostic-only`, `blocked`,
`cooperative-current-process`, and `external-attested` as distinct decision
kinds. Each kind carries separate completion eligibility, assurance,
authority-provider, and consumption-state fields.

A cooperative current-process capability remains module-private and
nonserializable. Copied JSON, casts, disk evidence, or receipt fields cannot
construct it. Finish still selects external assurance by default, and no
automatic fallback to cooperative evidence is enabled. Issue #113 implements
only `--assurance cooperative`; `--require external` remains unimplemented.

## External Evidence Scope

V1 signed external evidence proves only the claims cryptographically bound by
the evidence:

- the exact public repository and immutable repository identifier;
- the canonical workflow file and certificate SAN identity;
- the run and run attempt;
- a `push` event on `refs/heads/main`; and
- the signed source identity and receipt bindings.

It does not prove historical or current branch protection, enrollment, review,
required checks, or approval state. Public wording must describe this as a
signed push to `refs/heads/main`; it must not describe the signed artifact
itself as proof of branch protection.

The signed push facts are checked against a separate, user-scoped enrollment
policy. Enrollment is product policy, not a signed artifact field. V1 supports
public repositories only. Private-repository authentication, authorization,
and credential lifecycle are deferred.

## Project Finish Attestation Schema Boundary

`project-finish-attestation.1` is a future project-consumer signed-subject
contract. Its receipt canonically binds a public repository identifier, a
`push` event on `refs/heads/main`, the workflow file and certificate SAN, source
identity, one repository-root Gradle project, the fixed Gradle command catalog,
test and build facts, PH version, and lifecycle run/attempt/finish/nonce values.

The DSSE subject must name the canonical receipt and match both the predicate
receipt digest and the verifier's recomputation from canonical receipt bytes.
Missing, extra, reordered, duplicated, or substituted subjects are invalid.
The receipt does not carry enrollment: enrollment remains a separate
user-scoped product policy and is not a signed field. A signed `push` to
`refs/heads/main` is not evidence of historical or current branch protection,
review, or approval.

This schema record is structural only. Until a later external verifier checks
the signature, certificate, identity, and replay state, parsed
`project-finish-attestation.1` evidence remains blocked as
`signature-unverified`. It is distinct from existing
`finish-attestation.1` evidence and cannot provide consumer authority, a
Finish PASS, or a closure terminal result.

## Cooperative Same-Invocation Contract

For V1, "same process" means one `ph workflow finish implement` invocation
owns the complete cooperative verification attempt. It does not require one
JVM or one operating-system process: Gradle and test-worker child processes
are permitted.

The required Gradle sequence is:

```text
./gradlew --no-daemon --no-build-cache cleanTest test --console=plain
./gradlew --no-daemon --no-build-cache build --console=plain
```

The runner validates the configured evidence root before taking snapshots or
writing any evidence. It owns pre- and post-command source snapshots and report
snapshots. The following outcomes block cooperative authority:

- a non-executed `:test` task or root `:build` task, including
  `UP-TO-DATE`, `FROM-CACHE`, or `NO-SOURCE` outcomes;
- stale or unchanged JUnit XML;
- zero executed tests or an all-skipped test result;
- malformed, unsafe, unreadable, oversized, binary, or symlinked reports; and
- any pre/post source, workspace, command-plan, or report-ownership drift.

The first `cleanTest` task may legitimately report no work in a fresh project;
it is not treated as test execution. The required `:test` task must execute.
The runner accepts dirty worktrees only when the complete tracked, staged,
unstaged, and included-untracked source identity is unchanged across both
commands.

## Status, Fetch, And Consumption

The cooperative capability is consumed in memory only by the same
`workflow finish implement --assurance cooperative` invocation that created
it. It writes no receipt, terminal record, marker, or reusable authority.
Status, evidence fetch, and `workflow closure next --json` cannot consume or
recover it; after a cooperative PASS, those surfaces remain external-only and
block without independently valid external evidence.

External-attestation consumption remains separate. When external authority is
available, its lifecycle may use its exclusive terminal record and bindings;
the cooperative path never writes or accepts that record.

## Enrolled Public Artifact Retrieval

The packaged `ph authority` route is deliberately split: interactive
`enroll github <owner/repository> --workflow <path>` stores a user-scoped
public enrollment only after fixed GitHub policy readback, while `fetch github`
downloads matching original public artifact bytes only through fixed GitHub
endpoints. Fetch stores an opaque original archive in the user store, not in a
caller workspace, and does not consume authority. Status and Finish select only
an enrolled artifact that independently passes the project verifier against the
current project source. Registry/package provenance is a separate read-only
release property and never substitutes for this consumer authority path.

## Evidence Reference Discipline

The V1 reference fixture is for the public `jyt6640/persona-harness`
repository and the canonical clean-CI attestation workflow. Its immutable
repository, workflow, run, artifact, and bundle identifiers are retained in
the independently reviewed evidence packet rather than reconstructed from
project-local copies.

The only decoded DSSE payload digest admitted by this decision is:

```text
sha256:4203eb7100c632274cefbd2d37949fd9311f2217fb8f8779811099bb7cbcfa6e
```

This is the independently verified decoded payload digest. This record does
not cite alternate supplied payload or projection hashes. A later implementation
or acceptance record must bind its own exact run, artifact, bundle, and
subject digests before using any fixture as positive evidence.

## Sequencing

After this decision merges:

1. Issue #109 and Issue #110 may begin.
2. Issue #113 may begin only after Issue #109.
3. Issue #111 may begin only after Issue #110.

Issue #113's source and fresh packed-consumer fixture checks are separate from
external authority. A registry-installed positive is expressly deferred to
Issue #116 after Issue #122; this implementation does not publish, tag, or
claim registry evidence.

## Boundary

This record does not change registry, tag, release, dist-tag, package version,
external-assurance default, or schema behavior. The only Finish behavior added
by Issue #113 is the explicit, same-invocation cooperative path above.
