# Project Finish Attestation Producer

This source candidate adds the producer-side contract for
`project-finish-attestation.1`. It does not add a verifier, an external
authority decision, a Finish PASS, a release action, a registry action, or a
reusable local authority record.

## Fixed Producer Boundary

The reusable workflow
`.github/workflows/persona-harness-project-finish.yml` has no caller inputs.
It runs only for a public-repository `push` event on `refs/heads/main`. The
workflow checks out the pushed consumer source and a separately checked-out,
immutable Persona Harness reusable-workflow revision. It derives all receipt
facts itself:

- consumer repository numeric ID and slug;
- caller workflow reference and checkout SHA;
- reusable workflow reference and immutable SHA;
- fixed Gradle test/build catalog, fresh JUnit digest/counts, build-output
  digest, and complete source identity;
- PH version; and
- run, attempt, finish, session, nonce, issuance, and expiry values.

Before checking out Persona Harness, the workflow reads the already checked-out
caller workflow at GitHub's bounded caller-workflow identity. A bounded
structural parser accepts exactly one YAML job mapping for
`jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml`
reference with a full immutable SHA. Branches, tags, another repository or
path, duplicate declarations, malformed YAML, and unsafe workflow paths block
with a bounded diagnostic. The caller checkout SHA is bound separately and is
never used as the Persona Harness checkout ref. After checkout, the producer
cross-checks the parsed SHA against the reusable `job_workflow_sha` claim
before it builds the canonical subject. The caller `workflow_sha` remains
separately bound to the caller checkout SHA; it is not a reusable-workflow
revision. The reusable `job_workflow_ref` may identify only the fixed Persona
Harness repository and workflow path at `refs/heads/main`, while the parsed
immutable caller pin, reusable SHA claim, and producer checkout HEAD must all
agree. The OIDC event, ref, public repository identity, run ID, run attempt,
and GitHub-hosted runner claim must also match the platform environment. The
checked-out producer must normalize to the fixed
`github.com/jyt6640/persona-harness` identity. Only the canonical GitHub HTTPS
checkout spelling, with or without its optional `.git` suffix, is accepted;
credentials, userinfo, query or fragment components, another host, noncanonical
paths, and SSH-style remotes block without reflecting the remote text.

The canonical receipt bytes are the Artifact Attestation subject. The predicate
binds their SHA-256 digest. The workflow uploads only the receipt, predicate,
signed bundle, or an allowlisted failure diagnostic code.

Signed V1 evidence may assert only a `push` to `refs/heads/main` and the exact
bound repository, workflow, run, and source facts. It does not prove branch
protection, enrollment, review, approval, or any push-to-enrolled-main claim.
Enrollment remains separate user-scoped policy for a later verifier.

## Source Candidate Boundary

The tracked caller workflow fixture is a static source contract only. It uses
an immutable commit-shaped reusable-workflow reference to prove that mutable
`@main` use is rejected by policy. It is not a real caller and cannot produce
evidence.

This source candidate contains no genuine signed original artifact. After
protected integration, the separate authorized producer gate must:

1. update the existing public
   `jyt6640/persona-harness-attestation-claim-fixture` caller to pin the
   integrated reusable-workflow SHA;
2. push a fresh public fixture commit to `refs/heads/main`;
3. preserve the GitHub Actions run, artifact ID, subject SHA-256, predicate
   SHA-256, bundle SHA-256, and sanitized failure status if blocked; and
4. defer Issue #111 closure until that original artifact is independently
   verified by the later consumer verifier and External gate.

No copied JSON, local receipt, JUnit file, synthetic fixture, caller-supplied
fact, or package-release attestation becomes consumer authority through this
producer.

## Distribution Boundary

The workflow, builder, and caller fixture are repository-only source material.
The package ships this boundary record and compiled structural modules, but no
signed fixture, caller workflow, producer script, or public success command.
