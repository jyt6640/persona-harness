# P0-1 `ph go` Acceptance Record

Status: accepted on exact main

## Accepted Main

P0-1 accepts the host-neutral prepared-project entry
`ph go "<concrete implementation goal>"` at:

```text
c097428d3327f599e47ce20069ce768e5d4f3b66
merge: integrate transactional go recovery
```

The merge parents are pre-main `e853b0f194710ad310b495a0a0ddd8e67adb90d4`
and accepted candidate `d4f1c2adf5e3e1526ca74e079c4f42a281371700`.
Exact-main QA confirmed the P0 file set was retained from the candidate without
merge-conflict resolution changes.

## Provenance

The accepted history is:

```text
24d4fa0 -> d807196 -> d4f1c2a -> c097428
```

- `24d4fa0` introduced the transactional `ph go` entry, but it predates the
  accepted cooperative recovery-claim and revalidation contract, so it was not
  accepted as the P0-C candidate.
- `d807196` added recovery hardening but was not accepted: `ph go --help`
  exposed recovery outside stale-lock blocker guidance, and abandoned-claim
  reclamation could remove a second cooperative recoverer's live claim.
- `d4f1c2a` corrected both points with hidden normal help, owner-specific
  generation claims, pending-claim exclusion, owned-only cleanup, and a
  deterministic two-recoverer regression.
- `c097428` normally merged the accepted candidate into main. Item-7 QA and
  External then accepted that exact main commit independently.

## Accepted Contract

The supported threat model is C: cooperative local Persona Harness writers and
ordinary cooperative workspace edits. The record explicitly excludes hostile
same-user path replacement and symlink micro-races. It does not make a broad
atomicity or filesystem-security claim.

Normal `ph go` does not automatically delete stale or malformed lock material.
Recovery is hidden from normal help and is surfaced by the applicable normal
stale/malformed-lock blocker guidance. Recovery requires a generation/owner
claim protocol that binds owner, generation, device, inode, and raw bytes.
Pending claims are not treated as live claims; cleanup removes only unchanged
claim material owned by the caller.

The observed holder is revalidated twice: after claim publication and again
immediately before clearing the lock. A changed holder, active lock, claim
contention, or generation loss preserves state and follows the non-recovery
continuation.

The parser-error contract is narrower than state-blocker guidance. Empty stdin
and unknown options must exit nonzero, preserve workflow state, and provide a
clear error or usage indication. They do not need an invented actionable next
command. Setup, profile, plan, and pre-existing-state blockers retain the
single actionable-command requirement.

## Item-7 Evidence

Canonical QA accepted exact main `c097428` after source, behavior, and
integration retention checks. The independently built, fresh local-current
tarball package smoke also passed:

```text
/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p0-go-main-integration-package-smoke-c097428-20260710T121023Z
```

| Fact | Value |
| --- | --- |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh local-current tarball; registry not used |
| SHA-1 | `89582d3e956aa5c20c6b65481cae86a9720b7f6e` |
| SHA-256 | `0e1518082d8d4cbad635dcbb8e7e8cf517d2f11afe1d9a64ed48b03b8e3aa036` |
| Entry count | `705` |

The installed package exercised positional and stdin `go`, hidden recovery,
stale/malformed/legacy lock preservation and recovery, active/claim-contention
preservation, the two-recoverer election, parser errors, and
`runtimeInjection=false`.

`npm test` taxonomy warning for
`docs/phase1-test-contract-repeat-report-review.md` and the direct README-link
expectation failure in `tests/package-files-policy.test.ts` were reproduced on
the exact pre-main baseline. They are pre-existing exceptions, not P0
integration regressions, and this record does not fix them.

## Boundaries And Next Decision

No runtime-injection default, schema, evidence-schema, version, publish, tag,
`latest`, or `next` movement is accepted here. This record makes no
token-saving, provider-token-saving, efficacy, app-quality, broad reliability,
enforcement, delegation, or hostile-race claim.

LEAN L-3 remains separately partial with Filter 2 only; Filter 3 and Filter 4
remain parked, and L-4 has not started.

Recommendation: close Tranche 0 as accepted at `c097428` and keep any
subsequent P0 work as a separately dispatched, independently accepted tranche.
