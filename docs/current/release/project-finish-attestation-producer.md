# Project Finish Attestation Producer

This source candidate adds the producer-side contract for
`project-finish-attestation.1`. It does not add a verifier, an external
authority decision, a Finish PASS, a release action, a registry action, or a
reusable local authority record.

## Fixed Producer Boundary

The reusable workflow
`.github/workflows/persona-harness-project-finish.yml` has no caller inputs.
It runs only for a public-repository `push` event on `refs/heads/main`. The
workflow derives three fixed sibling paths below the platform-owned runner
workspace: `.project-finish-caller` for the pushed consumer source,
`.persona-harness-producer` for the immutable producer revision, and
`.project-finish-attestation-artifacts` for a successful subject and predicate.
The failure diagnostic uses the separate fixed
`.project-finish-attestation-failure` directory. None is a caller input. The
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
caller workflow inside `.project-finish-caller` at GitHub's bounded
caller-workflow identity. A bounded
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
Harness repository and workflow path at that parsed immutable revision, while the parsed
immutable caller pin, reusable SHA claim, and producer checkout HEAD must all
agree. The OIDC event, ref, public repository identity, run ID, run attempt,
and GitHub-hosted runner claim must also match the platform environment. The
caller workflow reference and SHA must independently match the platform caller
workflow reference and SHA, while the reusable workflow reference and SHA must
match the parsed immutable pin and the checked-out Persona Harness revision.
Repository visibility is not accepted from a raw runner variable: the producer
receives it only through its fixed `PERSONA_HARNESS_CALLER_VISIBILITY` mapping
from the GitHub public-repository event context, and cross-checks that value
against the signed claim. The runner environment and Linux runner OS are
separate required bindings.

The
checked-out producer must normalize to the fixed
`github.com/jyt6640/persona-harness` identity. Only the canonical GitHub HTTPS
checkout spelling, with or without its optional `.git` suffix, is accepted;
credentials, userinfo, query or fragment components, another host, noncanonical
paths, and SSH-style remotes block without reflecting the remote text.

## Producer OIDC Capability Boundary

The signing job obtains its fixed-audience GitHub OIDC token only through the
immutable `actions/github-script` Toolkit capability bridge. The bridge loads
the fixed producer builder before requesting the token, then keeps the token
in the trusted JavaScript call chain while it invokes that builder. It does not
read runner OIDC request variables, pass a token through a shell, `PATH`, child
process, workflow input, output, artifact, summary, or log, or accept a
caller-provided endpoint, audience, or trust value.

The builder accepts that in-memory token only after strict issuer and audience
validation, then applies the existing public-push, caller/reusable workflow,
source, checkout, and receipt bindings. An unavailable Toolkit capability,
bridge load or invocation failure, or invalid token blocks with the fixed
`project-finish-producer-oidc` code and creates no receipt, predicate, signed
bundle, or authority result. This is a source contract only: it does not
assert that a producer invocation has successfully signed an artifact.

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
preflight. The separate OIDC job has no diagnostic `run:` step. It invokes the
immutable `actions/github-script` runtime, which obtains the token through the
documented Actions Toolkit `core.getIDToken` capability with the fixed
audience. The token remains in that trusted JavaScript runtime and is passed
only in memory to a fixed source-only bridge from the verified Persona Harness
checkout. The reusable diagnostic step sets an explicit fixed
`PROJECT_FINISH_DIAGNOSTIC_*` environment allowlist for the public-push facts:
event, ref, repository identity, caller workflow identity, source SHA, parsed
diagnostic pin, run/attempt, and GitHub-hosted runner facts. It never aliases
the runner OIDC request URL or token through workflow `env`, action inputs, or
outputs. The bridge ignores `INPUT_*`, private OIDC aliases, and ambient GitHub
context values for the security context. No shell, `env`, `node`, or `git`
launcher is resolved through ambient `PATH` after the OIDC-bearing job begins.
The decoded OIDC claim supplies the observed reusable-workflow reference and
SHA, which are checked separately from the caller workflow SHA/ref and the
parsed pin. Ambient runner environment, home, Git configuration, and caller
values cannot enter the evaluator.

The ordinary pull-request and branch selftest is intentionally id-token-free.
Its bounded summary labels native runner OIDC as `not-collected` and
`not-required`; it is not evidence that the native runner capability works.
The reusable workflow instead runs a separate native selftest with
`id-token: write` through the same pinned Toolkit capability bridge. If the
native path blocks, it records one fixed native stage before the upload:
`capability` for a Toolkit acquisition failure, `bridge` for a fixed source
bridge import or handoff failure, `validation` for a bounded token, audience,
or claim failure, or `context` for a later fixed context mismatch. The outer
decision remains blocked for every non-match stage. These stages are codes and
statuses only; they do not expose an error, token, claim, URL, path, or
exception. A `context` block adds only fixed identity-field codes for the
event, ref, public repository, caller and reusable workflow identities,
run/attempt, runner, source head, and producer checkout; it never includes
the corresponding values. A native selftest cannot silently omit the OIDC
case or convert an id-token-free check into native evidence.

Its summary contains only allowlisted `match`, `missing`, or `mismatch` field
statuses and bounded diagnostic codes. It does not store a JWT, token, header,
repository URL, ref, SHA, workspace path, source content, or caller input. The
diagnostic reports `networkAccess: true` with the fixed
`github-actions-oidc-only` scope because it may read the GitHub Actions OIDC
claim in memory. It has no registry or arbitrary network route. The bridge
does not construct a bearer request or accept an endpoint value. Direct
endpoint handling elsewhere remains limited to the fixed hosted GitHub Actions
endpoint form, rejects malformed or untrusted endpoint text without a request,
and never follows a redirect. Its bounded summary records whether OIDC
acquisition was attempted, but never records endpoint text or a token.
It creates no receipt, predicate, signed bundle, attestation, Finish result,
or authority record. A separately uploaded summary artifact is diagnostic-only
and is not attested or authority-bearing.

Before the OIDC capability bridge runs, a separate token-blind local
`node20` action creates the fixed bounded fallback under the platform-owned
runner temporary root at
`project-finish-attestation-context-diagnostic/summary.json`. That pre-step
rejects relative, noncanonical, or symlinked temp roots and creates the child
directory and summary file without following a caller-workspace path. The
workflow explicitly clears the OIDC request variables for the fallback,
finalizer, and post-upload result steps.

The OIDC bridge verifies that exact fallback exists but does not
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

Within the real reusable diagnostic workflow, a separate
`hosted-selftest` job has `id-token: write` and uses the same explicit private
context map as the diagnostic bridge. Its selftest uses the actual Toolkit OIDC
capability, requires every production context status to match before the
ordinary diagnostic bridge can run, and keeps unavailable capability
fail-closed after artifact upload. It uploads only a diagnostic-only case
result and never creates a receipt, predicate, signature, registry result, or
authority state.

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

## Caller Intake Boundary

The producer accepts a public Gradle caller without a Persona intake profile.
That exception is limited to the producer path; ordinary cooperative Finish
still requires its local ready profile and remains blocked for a profile-less
workspace. When the optional profile is present, it must be a bounded,
canonical Java/Spring/Gradle profile.

The supplied caller root is captured as a canonical workspace identity before
intake. Relative and absolute spellings must resolve to the prepared workspace
identity; any mismatch blocks before descriptor or source capture. Every
subsequent intake, Gradle, JUnit, and source-snapshot operation uses that one
verified canonical root, so a relative caller path cannot create a second
containment base.

The caller root is never the ambient runner workspace. The builder accepts
only the fixed direct `.project-finish-caller` child after no-follow directory
and canonical identity checks, then rechecks the runner and caller identities
before artifact preparation. A caller checkout alias, a symlinked caller root,
or a replaced root blocks. The immutable producer checkout remains the sibling
`.persona-harness-producer`; its dependency links are not caller source and are
therefore not scanned or excluded. This structural separation never broadens
the caller source exclusion list: a symlink anywhere inside the caller tree
still blocks. Git metadata remains the existing explicit `.git` exclusion, so
normal Git directory and worktree link-file representations do not become
caller source entries.

Before any fixed Gradle command, the producer reads the optional profile and
exactly one `build.gradle`/`build.gradle.kts` plus one
`settings.gradle`/`settings.gradle.kts` through no-follow file descriptors.
It verifies post-open regular-file and stat identity invariants, binds only
their digests and verified descriptor identities into the source snapshot, and
captures the same inputs after the fixed commands. Missing, malformed,
oversized, nonregular, symlinked, replaced, or changed inputs block before a
receipt, predicate, signed bundle, or authority result can exist. The
content-aware source snapshot uses the same no-follow read discipline for
caller source files and rejects unsafe replacement during capture.

Receipt and predicate bytes are written privately into a freshly created,
runner-owned staging directory and promoted only into the fixed artifact
directory after caller and runner identity rechecks. A blocked caller or
artifact-directory condition may leave only a bounded failure diagnostic in its
separate runner-owned directory; no receipt, predicate, bundle, or signature is
created. A caller-controlled `.ci` path is never used for producer artifacts.

## Signed Artifact Handoff

The successful artifact directory is intentionally hidden from the caller
checkout and has one fixed lifecycle. Before signing it contains exactly
`receipt.json` and `predicate.json`; after the pinned attestation action it
contains exactly those files plus `bundle.json`. The producer-owned handoff
script opens every file with no-follow descriptor checks, verifies bounded
nonempty regular files and directory identities before and after each phase,
and copies the pinned attestation action's bundle output into a newly created
private `bundle.json`. It treats the bundle as opaque bytes for upload only; it
does not validate a signature or create any authority result.

An empty, missing, stale, extra, aliased, symlinked, replaced, or oversized
handoff file blocks before the successful upload step. A blocked handoff can
write only the fixed bounded failure diagnostic when its runner-owned root is
still safe; it never follows an artifact alias or exposes a source path,
bundle, token, claim, raw log, Finish result, release result, or authority
state. The workflow explicitly uploads the three fixed hidden success paths
with `include-hidden-files: true`, then uploads the one fixed hidden failure
diagnostic path with the same opt-in. The explicit files and upload
postcondition prevent an empty directory match from being treated as an
original signed-artifact handoff.

This source boundary is not a signing result. The remaining hosted-only
residual is one separately authorized GitHub public-push producer observation,
followed by independent verification of its original signed artifact.

## Distribution Boundary

The workflow, builder, and caller fixture are repository-only source material.
The package ships this boundary record and compiled structural modules, but no
signed fixture, caller workflow, producer script, or public success command.
Because this boundary record is package-visible, a candidate that changes it
can retain the same package path set but content-different package bytes. It
must not claim byte-identical package output or waive installed-package review
only because the workflow and local actions are excluded; it requires fresh
External verification.
