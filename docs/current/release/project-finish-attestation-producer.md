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

## Context Diagnostic Gate

When a genuine reusable producer invocation blocks before signing with a
bounded context code, the separate reusable workflow
`.github/workflows/persona-harness-project-finish-context-diagnostic.yml`
can be pinned by a public caller on a fresh `push` to `refs/heads/main`.
It has no caller inputs and repeats the same caller-source verification,
immutable caller-pin parsing, immutable Persona checkout, and fixed
public-push context policy before it reads the fixed GitHub OIDC claim in
memory.

The diagnostic resolver does not use the called reusable workflow's job ID to
select a caller job: GitHub may expose the called job identity rather than the
caller invocation job. Instead, after bounded structural parsing, it accepts
exactly one full immutable pin for the fixed diagnostic workflow path across
the checked-out caller workflow. The parsed diagnostic SHA remains separate
from the caller workflow SHA and is cross-checked against the diagnostic
checkout and OIDC reusable-workflow identity.

The id-token-free resolution job performs the caller-pin and producer-checkout
preflight. The separate OIDC job has no diagnostic `run:` step: it loads a
fixed local `node20` action from the verified Persona Harness checkout. That
action has no security-context `with:` inputs. The reusable diagnostic step
sets an explicit fixed `PROJECT_FINISH_DIAGNOSTIC_*` environment allowlist for
the public-push facts: event, ref, repository identity, caller workflow
identity, source SHA, parsed diagnostic pin, run/attempt, and GitHub-hosted
runner facts. It passes the platform OIDC endpoint and request token only
through those private aliases to the in-memory OIDC reader. The action ignores
`INPUT_*` names and ambient GitHub/OIDC context variables for these values. No
shell, `env`, `node`, or `git` launcher is resolved through ambient `PATH`
after the OIDC-bearing job begins.
The decoded OIDC claim supplies the observed reusable-workflow reference and
SHA, which are checked separately from the caller workflow SHA/ref and the
parsed pin. Ambient runner environment, home, Git configuration, and caller
values cannot enter the evaluator.

Its summary contains only allowlisted `match`, `missing`, or `mismatch` field
statuses and bounded diagnostic codes. It does not store a JWT, token, header,
repository URL, ref, SHA, workspace path, source content, or caller input. The
diagnostic reports `networkAccess: true` with the fixed
`github-actions-oidc-only` scope because it may read the GitHub Actions OIDC
claim in memory. It has no registry or arbitrary network route. Before it
constructs a bearer header, the OIDC helper accepts only the fixed hosted
GitHub Actions endpoint form, rejects malformed or untrusted endpoint text
without a request, and never follows a redirect. Its bounded summary records
whether an OIDC request was attempted, but never records endpoint text or a
token.
It creates no receipt, predicate, signed bundle, attestation, Finish result,
or authority record. A separately uploaded summary artifact is diagnostic-only
and is not attested or authority-bearing.

Before the OIDC-bearing local action runs, a separate token-blind local
`node20` action creates the fixed bounded fallback under the platform-owned
runner temporary root at
`project-finish-attestation-context-diagnostic/summary.json`. That pre-step
rejects relative, noncanonical, or symlinked temp roots and creates the child
directory and summary file without following a caller-workspace path. The
workflow explicitly clears the OIDC request variables for the fallback,
finalizer, and post-upload result steps.

The OIDC diagnostic action verifies that exact fallback exists but does not
replace it until the fixed evaluator has produced a valid bounded result. A
missing evaluator, evaluator load failure, evaluator runtime failure, or
summary write failure leaves the fallback unchanged. The trusted finalizer
preserves a valid bounded result or restores a fixed blocked fallback using
only the diagnostic step outcome and bounded action output. The workflow
uploads the fixed runner-temp path with `if: always` before a token-blind local
action marks a blocked diagnostic nonzero. It never writes a diagnostic summary
below caller workspace, installs dependencies, uses an ambient dependency
cache, or invokes a child process to obtain the diagnostic artifact.
The diagnostic action reads only its fixed private environment aliases. The
separate fallback, finalizer, and outcome actions use their own narrowly scoped
declared action inputs and do not receive the OIDC-bearing aliases.

A separate hosted Linux `node20` selftest executes the exact local entrypoint
from a checkout without `node_modules` or `npm install`. It checks missing
evaluator, evaluator runtime failure, OIDC-blocked, and a synthetic canonical
private-environment map. The canonical selftest asserts every reported context
field is an allowlisted `match`; every path leaves a sanitized summary artifact
available for upload. The selftest has no `id-token` permission and does not
create producer evidence.

A diagnostic `match` is not a producer success and does not enable a retry,
external trust, completion, release, or Finish authority. After protected
integration and fresh source QA plus External approval, one authorized public
fixture diagnostic push may preserve its sanitized summary. That result is the
required observability gate before any later separately authorized producer
retry.

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
Because this boundary record is package-visible, a candidate that changes it
can retain the same package path set but content-different package bytes. It
must not claim byte-identical package output or waive installed-package review
only because the workflow and local actions are excluded; it requires fresh
External verification.
