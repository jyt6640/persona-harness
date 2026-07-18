# Consumer Authority V1 Decision

Status: Issue #108 source decision only. This record defines an implementation
target for later issues; it does not add an authority path, CLI flag, workflow,
release action, or Finish PASS claim.

## Decision

V1 separates two assurance modes:

- The existing default remains external evidence or a blocked result. Missing,
  unavailable, malformed, expired, replayed, or mismatched external evidence
  remains blocked.
- A later explicit `--assurance cooperative` mode may use the defined
  same-invocation cooperative runner. This flag is not implemented by this
  record.
- A later `--require external` mode remains strict and accepts only the
  external evidence path. This flag is not implemented by this record.

No local receipt, JUnit report, TDD record, digest, generated marker, or
caller-supplied JSON becomes authority through this decision.

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

The runner owns pre- and post-command source snapshots and report snapshots.
The following outcomes block cooperative authority:

- `UP-TO-DATE`, `FROM-CACHE`, or `NO-SOURCE` task outcomes;
- stale or unchanged JUnit XML;
- zero executed tests or an all-skipped test result;
- malformed, unsafe, unreadable, oversized, binary, or symlinked reports; and
- any pre/post source, workspace, command-plan, or report-ownership drift.

The existing fresh-verification and JUnit/source-identity modules are reusable
input boundaries. This decision does not change their current diagnostic-only
authority result.

## Status, Fetch, And Consumption

Status, evidence fetch, and `workflow closure next --json` are non-consuming.
Each must independently validate the selected evidence and bindings before
reporting an eligible preview. `workflow finish implement` is the only
consuming surface.

Consumption and replay follow the existing external-attestation model:
successful Finish writes one exclusive terminal record, binds it to the
attestation, source, workspace, session, finish, run, nonce, receipt, and
expiry fields, and rejects a second or mismatched consumption. A preview never
creates that terminal record.

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

No positive authority claim is authorized by this documentation issue. Later
implementation, source QA, installed-package External, enrollment-policy, and
fixture-evidence gates remain separate.

## Boundary

This record changes no authority code, workflow, registry, tag, release,
dist-tag, package version, default, schema, or Finish/closure behavior.
