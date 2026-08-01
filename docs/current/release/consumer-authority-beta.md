# Consumer Authority Beta Lifecycle

The Consumer Authority Beta is a staging-first, non-authoritative package
lifecycle. It combines a fixed package provenance route with the separate
user-scoped consumer authority route; neither one automatically promotes a
package or makes Finish pass.

`0.8.0-beta.1` through `0.8.0-beta.14` are immutable staging-only evidence.
Their registry and provenance observations cannot be reused as beta.15
current-version consumer authority evidence. Beta.14 established current
original artifact bytes, online crypto verification, authenticated fetch, and
separate caller/reusable signer binding, but the final disposable consumer had
no initialized workflow state and Finish made no authority decision. The active
`0.8.0-beta.15` source candidate has no
package, tag, channel movement, GitHub release, or signed consumer-project
artifact at source preparation time.

The prior beta candidates are retained as staging-only NO-GO or
source-preparation evidence: none qualifies for promotion or issue closure
because it did not complete the full current-version public consumer route.
Beta.15 must establish the remaining public readiness and final authority route
independently; it cannot inherit beta.14's artifact/fetch result, an earlier
lifecycle, or an earlier authority result.

The consumer must create its own workflow state through public bootstrap and
report/evidence commands in the exact project that later fetches authority.
An uninitialized `ph workflow finish implement` is a bounded nonzero
`workflow-state-uninitialized` block, never an authority-neutral success.
After public initialization the same command must reach only
`trusted-authority-required` before an artifact is available; a modeled trusted
artifact then proves one real Finish consumption and immediate replay block
without standing in for hosted crypto evidence.

## Fixed Sequence

1. An approved protected-main source candidate has strict prerelease SemVer
   and an existing matching immutable `v<version>` tag.
2. The manual publish workflow permits only `staging` with `staging-only` for
   that prerelease, publishes once through npm Trusted Publishing, and records
   bounded version/gitHead/SHA-1/SRI/SHA-256/tag readback.
3. The controlled staged-package producer attests the exact downloaded npm
   tarball. The fixed online verifier independently checks the original npm,
   GitHub, and Sigstore bindings before any later promotion decision.
4. A fresh exact registry installation proves the packaged CLI boundaries. A
   public consumer separately enrolls its fixed workflow, fetches original
   signed bytes, verifies them against its current source, and only an explicit
   Finish may consume a trusted result once. Before fixture authorization, the
   package-visible observer credential-preflight obtains a host credential
   without output and sends it only to its isolated fixed GitHub Actions
   read-only worker. It keeps the consumer HOME separate, never logs or
   persists the credential, does not invoke product/npm/archive tooling with
   it, and does not permit a product credential fallback. Fixed GitHub readback,
   not the credential or project content, establishes identity.

Before any fixture authorization, a fresh consumer must establish normal
lifecycle records through supported public commands. The fixture may use the
following sequence only with reports that describe its own observed work:

```text
ph bootstrap backend --strict --no-developer-mcp
ph bearshell ./gradlew test
ph bearshell ./gradlew compileJava
ph bearshell ./gradlew clean
ph evidence read README.md
ph evidence read .persona/project-profile.jsonc
ph evidence read src/main/java/<package>/<role>.java
<substantive implementation report> | ph plan --report-filled implementation --stdin
<substantive review report> | ph plan --report-filled review --stdin
ph workflow finish implement
```

That final default Finish must be blocked only by
`trusted-authority-required`. It must not retain implementation-report,
review-report, evidence, report-coverage, profile-read-coverage, Java-role-read,
or loop-state blockers. The public cooperative route remains a separate
same-invocation local test boundary and does not satisfy external authority.

`bootstrap` initializes only absent empty current loop-state records; it does
not repair malformed or stale state. In a fresh project, bootstrap holds a
project-root transaction while it assembles the initial `.persona` tree outside
the caller workspace, then promotes that tree only when `.persona` is still
absent. That same transaction writes `.gitignore` and
`.opencode/opencode.json`, then reserves canonical project-contained `.persona`
and `.persona/workflow` directories before modifying its harness config,
profile, policy, plan, role boundary, reports, or loop states. Each
bootstrap-owned leaf, including `AGENTS.md` staging and cleanup, stays within
the captured reservation and is checked with no-follow identity validation
through its write. A project-root, parent, leaf, temporary, or detected
replacement is an explicit unsafe lifecycle block: it writes no bootstrap artifact outside the project and does not perform automatic recovery. `--stdin`
accepts one bounded substantive report while the corresponding report is still
a template, then refuses a replacement. Its public report ingress enforces a
streaming 65536-byte ceiling
before decoding or collecting the input, so an oversized or continuously
producing pipe is rejected without replacing a report. The cleanup observation
prevents a prior ordinary build from making the fixed cooperative build task
non-fresh. Deleting either loop-state record, submitting malformed or oversized
report text, or copying a report/evidence record remains blocked. The default
Finish and later closure remain external-blocked after a cooperative PASS.
Public report ingress, plan status, and readiness evidence output retain only
stable project-relative references; they omit caller workspace and temporary
absolute paths.
Each `ph evidence read` record stores only a bounded digest and metadata for a
project-contained regular source file. Its source read uses native descriptor
traversal from the captured project capability: every root, parent, and leaf
is opened through a held no-follow directory descriptor. An unsupported,
missing, or checksum-invalid runtime blocks as
`source-read-runtime-unavailable`; there is no pathname or stat-after-open
fallback. The evidence write uses the same canonical project transaction, so a
target, evidence parent, leaf, temporary, or replacement alias blocks without
opening external bytes, writing outside the consumer workspace, or reflecting
source contents.

The final hosted evidence uses two fresh registry-installed fixtures, each
installing the exact immutable version only from `https://registry.npmjs.org`:

- the cooperative fixture runs `ph workflow finish implement --assurance
  cooperative` and requires its explicit same-invocation PASS while default
  Finish and later closure remain external-blocked; and
- the public external fixture runs the user-scoped `ph authority` enrollment,
  original-artifact fetch, independent verification, and explicit Finish
  consumption path against its own signed public push evidence.

Neither fixture can borrow the other fixture's evidence. Forged, copied,
wrong-repository/workflow/ref, drifted, replayed, expired, zero/all-skipped,
malformed/unsafe, or network-denied variants must remain nonzero with no
authority artifact or Finish PASS.

The external-attested fixture must pin the exact current package revision. The
verifier binds the signed receipt `phVersion` to its installed CLI version, so
an original artifact from `0.8.0-beta.1` through `0.8.0-beta.14` is a bounded
binding mismatch or historical-evidence block for `0.8.0-beta.15`; only a future
original signed artifact for the current immutable version can exercise
enrollment, fetch, explicit consumption, and replay rejection. The complete
source/packed acceptance contract is the structured
[`consumer-authority-beta15-acceptance.json`](consumer-authority-beta15-acceptance.json)
record; it names the exact public Java/Spring readiness route, the separate
caller and reusable certificate identities, the independent observer credential
preflight, the live certificate observation order, and the one hosted residual.

The source projection excludes only `.persona/.ph-init-manifest.json` and
`.persona/workflow` runtime metadata. The init manifest contains a
consumer-local canonical real path, so it is bootstrap ownership metadata rather
than caller project source. The profile, Gradle descriptors, Git identity,
reports, and evidence remain bound. This does not relax caller enrollment,
reusable SHA/SAN, repository, source, run, original-archive, or digest checks.

Before beta.15 package evidence is accepted, the verifier materializes the
exact complete-history bundle in a detached no-local checkout. It binds one
explicit canonical `refs/heads/...` candidate ref and
`refs/remotes/origin/main`; the candidate ref must equal the expected candidate
SHA and must be the only branch ref. A present bundle `HEAD` alias is accepted
only when it resolves to that same candidate SHA. The verifier also binds the
checkout CWD, Git top-level, npm prefix, and the byte-identical `package.json`
and lock from the selected candidate commit. It then runs isolated non-global,
non-workspace npm setup, a normal prepack, and a fresh installed CLI check. An
ambient workspace, stale `dist`, alternate npm prefix, cache selection, or
older package cannot stand in for the frozen tarball. The exact base is
materialized separately from the same bundle and packed under the same policy,
so package comparison cannot borrow either checkout's working directory or
generated output.

The pack invocation itself is plain `npm` from that bound checkout CWD;
`npm --prefix ... pack` is not an allowed package-root selector. The packaged
root-bound prepack runner builds from its own script location, and the one
authoritative bundle proof feeds its exact target tarball SHA-256 into both the
built source CLI and fresh installed consumer contracts.

For that observer, the authenticated product discovery route sends the enrolled
caller workflow filename directly to the fixed GitHub workflow-runs endpoint.
It does not reconstruct a second `.github/workflows/` prefix. The caller
workflow selects the run; the separate reusable producer SHA and certificate
SAN bind the signer. A missing, malformed, stale, mismatched, or expired result
is not retained.

## Live Verification Deadline

Before the one natural beta.15 fixture push, an independent observer may prepare
only an isolated exact registry installation, private consumer `HOME`,
enrollment, status, and explain. It must then run
`node node_modules/persona-harness/scripts/preflight-consumer-authority-observer.mjs --json`.
The preflight obtains a host `gh` credential without printing it, creates a
separate ephemeral observer HOME, and sends the credential only to the fixed
authenticated-user and empty sentinel Actions-metadata worker. It must report
`ready` before fixture authorization, and it must not download artifact bytes,
validate online crypto, consume Finish, observe replay, invoke `ph`, invoke npm,
or identify a future artifact. A blocked preflight authorizes nothing.

Once the current-version original artifact exists, the separately governed
observer sequence independently verifies the custom predicate online before the
leaf certificate `notAfter` deadline, uses the existing installed authority
fetch boundary, consumes exactly once, and immediately checks the replay-negative
result. A missed deadline is `certificate-window-expired`: it blocks without
fetch, Finish, or replay and never becomes a trusted result through local
self-validation or older beta evidence. A successful current-version fetch
retains only the verified artifact ID, digest, run, source, caller, and
reusable/SAN binding; any mismatch remains non-authoritative and is not stored.
The preflight credential never appears in output or persistent observer/consumer
state, and Persona Harness never reads host credential storage itself.

`ph authority status`, `ph authority fetch github`, and closure are
non-consuming. Missing enrollment, unavailable network, malformed records,
copied artifacts, source drift, replay, expiry, or any identity mismatch stay
blocked and never convert package provenance into Finish authority.
Multiple enrollments require an explicit enrolled `owner/repository` argument
to `fetch github`; ambiguous selection performs no network request.

## Live Trust Diagnostics

`ph doctor` performs a live, read-only Sigstore trust-root check with a
30-second whole-worker deadline. Its plaintext and JSON output report network
and trust-root readiness separately. The check uses a fresh product-owned
temporary cache that the parent process removes even when the child times out;
it never treats offline or previously cached material as a positive authority
result.

Consumer verification keeps these bounded, non-secret failure states distinct:
`dns-unavailable`, `network-unavailable`, `trust-root-unavailable`,
`verification-timeout`, `signature-invalid`, `certificate-invalid`,
`transparency-invalid`, and `malformed-bundle`. Diagnostics do not include
tokens, signed URLs, raw bundles, upstream error messages, or absolute paths.

## Promotion Boundary

The beta starts at `staging`. Moving the exact immutable version to `next`
requires a later independent `next-promotion-approved` action. `latest`,
Stable/GA claims, GitHub releases, and registry mutation are outside this
document's source-preparation boundary.
