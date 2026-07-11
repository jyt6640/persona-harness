# Item 19 CI Evidence Reverification Acceptance Record

Status: accepted on exact implementation main

## Accepted Main And Provenance

Item 19 accepts CI evidence reverification at:

```text
36e2908d2548503b8f3a8bcc922b441a58a6833e
feat(workflow): add CI evidence reverification
```

This exact implementation fast-forwarded from:

```text
09791561bb9675dda93c841232e5e06af2cf75f4
docs: define PH core adapter boundary
```

The accepted design lineage is retained separately:

```text
d703aa2 -> 68e869a -> f51abd1 -> 5ac3986 -> bdbe3bf
```

Those commits introduced the Item 19 design, mutation-policy decision,
deterministic command/artifact contracts, workspace identity binding, and
post-identity-capture correction. The implementation at `36e2908` realizes
the accepted Item 19 scope; this record does not alter it.

Canonical QA passed for the exact implementation candidate and again after
integration on exact main `36e2908`. Candidate External package acceptance
also passed. The post-integration External package smoke below independently
accepted the same exact main.

## Accepted Command Surface

The supported opt-in commands are:

```sh
ph workflow finish implement --reverify
ph workflow finish implement --reverify --ci
```

`--ci` is valid only with `--reverify`; a bare `--ci` is rejected nonzero and
does not create an artifact. The CLI accepts no other finish flags in this
surface, including no `--json` finish response.

`--reverify` runs a fresh PH-owned verification attempt before the existing
plaintext finish gate. `--reverify --ci` selects the explicit CI policy. The
plaintext finish exit result remains the authority for a CI driver. `ph
workflow closure next --json` remains the separate diagnostic companion; it
does not become a finish JSON protocol or a reverification authority channel.

## Accepted Reverification Scope

The first catalog is deliberately narrow:

- POSIX only, for a ready Java/Spring/Gradle project with a
  workspace-contained executable `./gradlew`.
- Direct no-shell argv only: `./gradlew test`, then `./gradlew build`, recorded
  as `gradle-wrapper-test.1` and `gradle-wrapper-build.1`.
- Each command has a 120-second bound; an attempt has a 300-second total
  budget. Commands run serially and stop after a non-passed result.
- Windows is unavailable. I19-7, a separately audited Windows execution
  contract, is not implemented.

Preflight rejects an unready or unsupported profile, missing or unsafe wrapper,
or (in CI mode) unavailable Git worktree/HEAD before a command starts. Those
preflight failures are `unavailable`.

Each attempt captures normalized Git porcelain/name-status data and workspace
identity before and after execution. The `mutationSnapshot.1` record includes
verified `preHead`/`postHead`, workspace realpath plus POSIX `dev`/`ino`,
evidence-parent identity for `.persona/evidence`, allowed/disallowed tracked
changes, and visible untracked changes. In CI, the pre/post Git HEAD and
workspace identities must remain equal. Newly observed tracked source/config
changes outside the declared Java/Gradle allowlist (`build/**` and
`.gradle/**`) are `partial`; untracked changes remain visible but report-only.
Local mode keeps observed mutation report-only by default.

The final status precedence is: `unavailable` only when safe preflight prevents
every command from starting; then any `timeout`; then `artifact-invalid`; then
identity failure or CI disallowed tracked mutation as `partial`; then an early
command failure as `failed` or a later failure/unavailability after a success
as `partial`; otherwise all successful commands with a valid artifact are
`passed`. A post-command inability to capture Git or workspace identity is
`partial`, subject to the higher timeout and artifact-invalid precedence.

## Artifact And Preservation Boundary

The fresh record is
`.persona/evidence/ci-reverification/<attempt-id>.json` with schema version
`ph-ci-reverification.1`. It is capped at 256 KiB and structurally redacted:
it records fixed catalog/argv identifiers, outcomes, exit and duration data,
byte counts, SHA-256 digests, JUnit references, mutation data, and fixed
diagnostic codes, but no raw child stdout, stderr, environment values, or
environment keys.

This bounded artifact is non-authoritative as independent CI proof or a
replacement for PH's current-invocation exit result. It does not make
agent-authored `.persona` ledger content independently trusted. A fresh
`--reverify` result is the narrow gate input for that same finish invocation.

PH does not delete, clean, revert, overwrite, or repair stale/malformed
ledger files or observed workspace mutations. It requires `.persona` and
`.persona/evidence` to be contained non-symlink directories before execution,
and revalidates the evidence-parent identity immediately before writing.
Post-command parent mismatch, write, strict reread, or artifact validation
failure is `artifact-invalid` unless timeout takes precedence.

## Exact-Main Evidence

External: PASS through the post-integration fresh local-current tarball package
smoke at:

```text
/tmp/persona-harness-external-archives/item19-ci-evidence-reverification-main-package-smoke-36e2908-20260711T082447Z
```

| Fact | Value |
| --- | --- |
| Target main | `36e2908d2548503b8f3a8bcc922b441a58a6833e` |
| Parent | `09791561bb9675dda93c841232e5e06af2cf75f4` |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh offline local-current tarball; registry not used |
| SHA-1 | `f65a929591e043b7293fa5648f268d9e793f8432` |
| SHA-256 | `2176c105ac766a3f7a8276d9287623710d7ce55922a3d249578f068a44a13b3a` |
| Integrity | `sha512-6Ib5NFdXkOoD5uXE84uWMfEI+uWctVsVUyYzacvX2KxOPI4DCm3lvnIAzrvjkVTzkSILi7jtH4Ph6gU7bWsN/g==` |
| Entry count | `719` |

The archive verifies the compiled CI reverification surface, valid POSIX
Java/Spring/Gradle success, command failure, preflight unavailable cases,
CI/local mutation behavior, post-capture HEAD behavior, evidence-parent
replacement refusal, artifact structural redaction, Windows unavailable,
invalid-input nonzero behavior, and `features.runtimeInjection=false` without
a hook directory.

## Boundaries

This is a bounded workflow verification record. It does not claim CI
correctness, generated-application certification, product efficacy, app
quality, security, token saving, or broad reliability. The identity checks
cover cooperative workspace integrity, not hostile same-user path/symlink
micro-races or a switch-away-and-back security guarantee.

No runtime injection/default, hook requirement, schema or evidence-schema
promotion, version, release, publish, tag, `latest`, or `next` movement is
accepted here. No automatic cleanup/revert behavior or Windows support is
added by this record.
