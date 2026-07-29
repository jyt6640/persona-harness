# Consumer Authority Beta Lifecycle

The Consumer Authority Beta is a staging-first, non-authoritative package
lifecycle. It combines a fixed package provenance route with the separate
user-scoped consumer authority route; neither one automatically promotes a
package or makes Finish pass.

`0.8.0-beta.1` through `0.8.0-beta.9` are immutable staging-only evidence.
Their registry and provenance observations cannot be reused as current-version
consumer authority evidence. Beta.9 did produce an independently verified
original artifact, but its authenticated installed fetch retained no artifact
identity because it sent the enrolled workflow filename as a repository path.
Its
certificate SAN identifies the Persona reusable producer workflow while its
receipt identifies the fixture caller workflow; those identities remain
separate. The active `0.8.0-beta.10` source candidate has no package, tag,
channel movement, GitHub release, or signed consumer-project artifact at
source preparation time.

The prior beta candidates are retained as staging-only NO-GO or
source-preparation evidence: none qualifies for promotion or issue closure
because it did not complete the full current-version public consumer route.
Beta.10 must establish that route independently and cannot inherit beta.9's
verified-but-unretained artifact, an earlier lifecycle, or an earlier authority
result.

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
   Finish may consume a trusted result once. The fixture supplies `GH_TOKEN` or
   `GITHUB_TOKEN` only as an in-memory Actions-read transport credential; fixed
  GitHub readback, not the credential or project content, establishes identity.

Before an explicit cooperative Finish, a fresh consumer must establish normal
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
ph workflow finish implement --assurance cooperative
```

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
an original artifact from `0.8.0-beta.1` through `0.8.0-beta.9` is a bounded
binding mismatch or historical-evidence block for `0.8.0-beta.10`; only a future
original signed artifact for the current immutable version can exercise
enrollment, fetch, explicit consumption, and replay rejection. The complete
source/packed acceptance contract is the structured
[`consumer-authority-beta10-acceptance.json`](consumer-authority-beta10-acceptance.json)
record; it names the exact public Java/Spring route, the separate caller and
reusable certificate identities, the pre-armed independent observer, the
live certificate observation order, and the one hosted residual.

For that observer, the authenticated product discovery route sends the enrolled
caller workflow filename directly to the fixed GitHub workflow-runs endpoint.
It does not reconstruct a second `.github/workflows/` prefix. The caller
workflow selects the run; the separate reusable producer SHA and certificate
SAN bind the signer. A missing, malformed, stale, mismatched, or expired result
is not retained.

## Live Verification Deadline

Before the one natural beta.10 fixture push, an independent observer may prepare
only an isolated exact registry installation, enrollment, status, and explain.
It must not download artifact bytes, validate online crypto, consume Finish, or
observe replay. Once the current-version original artifact exists, that observer
downloads it once, verifies the custom predicate online before the leaf
certificate `notAfter` deadline, consumes exactly once, and immediately checks
the replay-negative result. A missed deadline is
`certificate-window-expired`: it blocks without fetch, Finish, or replay and
never becomes a trusted result through local self-validation or older beta
evidence. A successful current-version fetch retains only the verified
artifact ID, digest, run, source, caller, and reusable/SAN binding; any
mismatch remains non-authoritative and is not stored.

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
