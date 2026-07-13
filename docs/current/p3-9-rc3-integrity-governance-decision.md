# P3-9 RC3 Integrity Governance Decision

Status: accepted exact-main integrity and package-external decision. This is not
an RC3 package release, tag, publish, `latest`, stable, or GA approval.

## Exact Assessment

- Assessed remote `main`:
  `bdfaefaab3755c74ff978fd6e32d98bd11abfbf4`.
- Direct parent:
  `78adc6f4c134efe4426b9f162bf31b60ef1c7009`.
- Complete-history source bundle:
  `/tmp/persona-p3-9-main-bdfaefa.bundle`.
- Bundle SHA-256:
  `6748f12d5529d55b8509ca1226f9a4ae5590f5e49abf2d0f0aa3f3405ee57422`.
- `git bundle verify` passed with `refs/heads/main` and `HEAD` at the assessed
  commit.
- The protected-main CI run `29260912730` completed successfully for the
  assessed commit.

Fresh detached QA, CLI, and installed-package checks all used this exact source
identity. The local package observation was `persona-harness@0.7.0-rc.2`,
824 entries, and zero `experiments/**` entries. Registry facts were kept
separate from local tarball facts.

## Integrity Findings

- P3-2 remains the common finish-authority boundary. Unsigned project-local
  bearshell text, JUnit XML, TDD JSON, markers, self-computed digests, arbitrary
  command metadata, stale IDs, and missing attestation remain diagnostic-only
  and cannot produce `workflow finish implement` PASS.
- P3-3 receipt and attempt records remain read-only and untrusted without the
  intended trusted authority path.
- P3-4 rejects zero-test verification, binds fixed command execution, and
  preserves existing CI-verification artifacts on duplicate publication.
- P3-5 accepts only structurally coherent red-to-green chains as
  `valid-untrusted`; that state is not finish authority.
- P3-6 keeps configured evidence roots canonical and fails malformed or unsafe
  paths closed without creating default or sentinel evidence roots.
- P3-7 keeps `ph init` reruns, conflicts, dry runs, symlink checks, and
  transaction recovery ownership-safe.
- P3-8 keeps PR/main CI, canonical main and tag ancestry checks, immutable
  action pins, registry integrity readback, and release idempotency checks.

These observations establish the bounded P3 behavior needed for the decision
below. They do not establish hostile-workspace security, a trusted external
finish authority, broad reliability, generated-app quality, or token-saving.

## Governance Facts

- `main` requires the strict `Verify repository` GitHub Actions check
  (app id `15368`), has zero required approvals for the single-owner workflow,
  dismisses stale reviews, requires conversation resolution, applies protection
  to administrators, and disables force pushes and deletion.
- GitHub Actions is enabled, requires SHA-pinned actions, and defaults workflow
  permissions to `read`.
- The `npm-publish` environment requires reviewer `jyt6640`, accepts protected
  branches, and disallows administrator bypass.
- Issue `#5` is closed after an authenticated trusted-publisher readback for
  binding id `1af02e10-b4ee-4370-b083-68a27c1cc2df`: GitHub,
  `jyt6640/persona-harness`, `publish.yml`, `npm-publish`, `createPackage`,
  and `createStagedPackage`.
- Issue `#10` remains open for the separate staged-publish least-privilege
  review. This decision does not treat that follow-up as resolved.
- The GitHub OIDC subject remains the default configuration. No immutable
  subject hardening claim is made here.

## Decisions

### P3-9 Exact-Main Validation: GO

The P3-9 exact-main source, authority, package, CI, and governance assessment
is accepted. It authorizes the narrow P2 decision below only.

### P2 Source-Only Resumption: GO

P2 may resume only through separately authorized source, measurement, or
report-only investigations. Each unit requires its own issue, isolated
provenance, and independent QA and External gates.

Completed historical P2 branches, bundles, and evidence remain retained. They
are not product, default, adoption, release, publish, stable, GA, or
effectiveness evidence merely because P2 investigation may resume.

### Stable, GA, npm `latest`, Publish, Tag, And Release: NO-GO

No new RC3 version, tag, package, release, registry readback, or dist-tag
movement was created by this decision. Strong completion-integrity, stable, GA,
and npm `latest` claims remain gated on a separate actual RC3 release cycle,
the required release and registry evidence, and the trusted external
attestation boundary described in the P3 roadmap.

## Boundary

This record changes no product source, workflow behavior, GitHub setting, npm
setting, version, tag, release, dist-tag, or package publication. It records a
governance decision from existing exact-source and read-only evidence only.
