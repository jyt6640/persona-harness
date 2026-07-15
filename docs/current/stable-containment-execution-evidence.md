# Stable Containment Execution Evidence

Status: durable pre-execution evidence record for issue #60. The approved
Option C decision is recorded, but the registry action has not been executed.
This document is an auditable preparation record, not proof that deprecation
has occurred.

## Audit Identity

- Audit date: 2026-07-15
- Protected-main SHA at audit start: `19508dc43a89216b1a9b179f251158770dcf88fa`
- Repository: `jyt6640/persona-harness`
- Decision owner record: issue [#42](https://github.com/jyt6640/persona-harness/issues/42)
- Approved decision comment:
  [#42 comment](https://github.com/jyt6640/persona-harness/issues/42#issuecomment-4976124403)
- Execution issue: [#60](https://github.com/jyt6640/persona-harness/issues/60)
- Execution state: not started; no `npm deprecate`, tag, dist-tag, release, or
  registry mutation has been performed.

## Registry Snapshot

The following facts are the read-only registry snapshot captured in the
supplementary containment evidence. They are metadata evidence, not a
substitute for the tracked record or a fresh pre-action read.

| Channel | Version | Git head | Shasum | Integrity | Publish time | Deprecation |
| --- | --- | --- | --- | --- | --- | --- |
| `latest` | `0.6.0` | `13b1f1b79884e2214c0b41a735b87cdd6d65ee00` | `ffd77996263cffb858bd977edb73b03cf2820c75` | `sha512-0dY/LqXYuSD7/G/GsALoE0RBKClikt1MPVR6GvbXRieBiSDh5CEt0JNP0RxJ8Ur3howsURYeaFQX8aRhSzKP0A==` | `2026-07-05T04:06:25.383Z` | not set |
| `next` | `0.7.0-rc.3` | `728e9c339463ea521fa4388a37d1c76f76c9d726` | `9d1fb27ab86d344afcd748b66959188ea9553258` | `sha512-P7ITZAhnOKmbq5RFKzTun7ruL8E4bJP1E049QcaAl3iMtPQZnQRevBfN+pE/tIBPyfNv0la5kPmQOwSADm4epQ==` | `2026-07-14T06:20:44.604Z` | not set |

Dist-tags at snapshot time were `latest=0.6.0` and `next=0.7.0-rc.3`.
The snapshot does not authorize treating `next` as a stable replacement.

## Minimal Black-Box Outcomes

The outcomes below preserve only expected/actual exits and bounded status
facts. Raw logs, prompts, evidence payloads, secrets, and user fixture values
are intentionally not copied into this record.

| Scenario | Expected safety result | `latest=0.6.0` actual | `next=0.7.0-rc.3` actual |
| --- | --- | --- | --- |
| Forged/local evidence followed by `workflow finish implement` | nonzero and no Finish PASS | exit `0`; Finish PASS observed | exit `1`; `trusted-authority-required`; no Finish PASS |
| Malformed harness config | nonzero and fail closed | doctor exit `0`; finish exit `1` for unrelated incomplete evidence, with no config-invalid blocker | doctor exit `1`; finish exit `1`; config-invalid blocker |
| Modified owned init material | nonzero and preserve sentinel | second init exit `0`; sentinel not preserved; owned file overwritten | second init exit `1`; sentinel preserved; ownership conflict |
| Blocked `workflow loop --dry-run` | nonzero when blocked | JSON/text exit `0`; final decision `not-run` | JSON/text exit `0`; final decision `not-run` |

The loop result is a separate registry-byte gap. It does not make `next` a
stable replacement and does not change the approved Option C decision.

## Approved Option C

Issue #42 is closed as the owner-approved decision. The exact approved
deprecation wording is:

> persona-harness@0.6.0 is deprecated: security containment advisory: stable
> 0.6.0 can treat local/forged workflow evidence as finish-authoritative, does
> not fail closed on malformed harness config, and can overwrite modified
> generated init files. Do not use 0.6.0 for workflow authority decisions. Use
> a QA-accepted fixed release when published; prerelease next is not a stable
> replacement.

Issue #60 is authorized to execute only after this durable evidence is
prepared and the exact pre-action npm metadata is reread. This record does not
execute the action, move `latest` or `next`, claim a fixed RC, or claim that a
stable remediation exists.

## Issue #60 Execution Checklist

The executor must complete and retain each item before closing #60:

1. Verify npm authentication and package ownership in the permitted
   owner-authenticated surface. Do not treat a local token or stale read as
   sufficient.
2. Immediately reread `npm view persona-harness dist-tags version gitHead
   dist.shasum dist.integrity time deprecated` and separately record the exact
   `latest` and `next` values. Expected pre-action state is
   `latest=0.6.0`, `next=0.7.0-rc.3`, with `0.6.0` not deprecated.
3. Execute only the exact owner-approved deprecation command:
   `npm deprecate persona-harness@0.6.0 "<approved wording>"`.
   Expected result: exit `0`; no version, tag, dist-tag, release, or package
   bytes change.
4. Immediately reread the exact package version, deprecation text, dist-tags,
   gitHead, shasum, integrity, and publish timestamps. Expected result:
   `0.6.0` has the approved warning; `latest=0.6.0` and
   `next=0.7.0-rc.3` are unchanged; immutable package metadata remains
   unchanged.
5. Perform a fresh empty-directory install of exact `persona-harness@0.6.0`
   and verify that the user-visible package metadata reports the approved
   deprecation warning. Record expected/actual exit and bounded warning
   presence only.
6. Retain a durable sanitized GitHub Actions artifact or tracked audit
   transcript containing the command, expected/actual exit, exact pre/post
   metadata, owner decision reference, wording, and secret-removal
   confirmation. The raw supplementary archive is not sufficient closure
   evidence.
7. Confirm no `latest`/`next` movement and do not perform any unrelated source,
   ref, tag, release, settings, or npm action.

## Evidence Manifest

This manifest is intentionally small and digest-bound. It identifies the
preparation record without embedding raw command output or sensitive fixtures.

```text
manifestVersion=stable-containment-evidence.1
auditDate=2026-07-15
protectedMain=19508dc43a89216b1a9b179f251158770dcf88fa
latest=0.6.0
latestGitHead=13b1f1b79884e2214c0b41a735b87cdd6d65ee00
latestShasum=ffd77996263cffb858bd977edb73b03cf2820c75
next=0.7.0-rc.3
nextGitHead=728e9c339463ea521fa4388a37d1c76f76c9d726
nextShasum=9d1fb27ab86d344afcd748b66959188ea9553258
decisionIssue=42
executionIssue=60
executionState=not-started
```

Manifest SHA-256:
`7fbb4e9fc44afc5db73870627b3d25513078002ca028190fde97fd0da50a07d6`

## Supplementary Evidence And Package Impact

The prior local package smoke and registry read-only report are supplementary
only:

`/tmp/persona-harness-external-archives/issue42-stable-containment-decision-20260714T225550Z/`

Raw files from that directory are not copied into the repository. The
canonical record is this tracked, sanitized document plus its commit
provenance. The new document is explicitly in the package allowlist because
direct links from `docs/current/README.md` must remain package-covered.
Against exact current main `19508dc43a89216b1a9b179f251158770dcf88fa`, the dry
pack contained 849 paths; this candidate contains 850 paths with exactly one
added path, `docs/current/stable-containment-execution-evidence.md`. The
existing package-visible `docs/current/README.md`, canonical index, inventory,
and `package.json` entries also change. Package shasum/integrity are
intentionally kept in the QA pack output rather than embedded here, because
this tracked document is itself part of the package and would make a
self-referential digest unstable.
External installed-package smoke is therefore required after QA for this
candidate; no registry package is used as source proof.

## Boundaries

This record does not claim product efficacy, app quality, broad reliability,
security certification, trusted finish authority, a fixed release, stable
replacement, or npm release readiness. It does not alter runtime defaults,
schemas, versions, tags, dist-tags, releases, registry state, or source
behavior.
